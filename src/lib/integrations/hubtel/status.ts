import {
  buildHubtelTransactionStatusUrl,
  getHubtelPaymentConfig,
  type HubtelPaymentConfig,
} from "@/lib/integrations/hubtel/checkout-config";
import { buildHubtelPaymentBasicAuthHeader } from "@/lib/integrations/hubtel/checkout";
import { PaymentStatus } from "@/types/enums";

const HUBTEL_STATUS_TIMEOUT_MS = 20_000;
const HUBTEL_ERROR_BODY_LOG_LIMIT = 400;

export class HubtelStatusRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "HubtelStatusRequestError";
    this.retryable = options?.retryable ?? true;
  }
}

export type HubtelTransactionLifecycleStatus =
  | "Paid"
  | "Unpaid"
  | "Refunded"
  | "Failed"
  | "Pending"
  | "Unknown";

export interface HubtelVerifiedTransaction {
  /** Mapped portal payment status (SUCCESS only when Hubtel reports Paid). */
  status: PaymentStatus;
  lifecycleStatus: HubtelTransactionLifecycleStatus;
  clientReference: string;
  providerReference: string;
  /** Amount in major units when Hubtel provides it; otherwise null. */
  amount: number | null;
  currency: string | null;
  paidAt: Date | null;
  rawStatus: string | null;
}

function sanitizeHubtelErrorBody(text: string): string {
  const redacted = text
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic ***")
    .replace(
      /"(client[_-]?secret|client[_-]?id|api[_-]?key|password|authorization)"\s*:\s*"[^"]*"/gi,
      '"$1":"***"',
    );
  if (redacted.length <= HUBTEL_ERROR_BODY_LOG_LIMIT) {
    return redacted;
  }
  return `${redacted.slice(0, HUBTEL_ERROR_BODY_LOG_LIMIT)}…`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parsePaidAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Map Hubtel transaction status strings to portal PaymentStatus.
 * Only "Paid" becomes SUCCESS. Ambiguous values stay PENDING.
 */
export function mapHubtelLifecycleStatus(
  rawStatus: string | null,
): {
  lifecycleStatus: HubtelTransactionLifecycleStatus;
  paymentStatus: PaymentStatus;
} {
  const normalized = (rawStatus ?? "").trim().toLowerCase();
  if (normalized === "paid" || normalized === "success" || normalized === "successful") {
    return { lifecycleStatus: "Paid", paymentStatus: PaymentStatus.SUCCESS };
  }
  if (normalized === "refunded" || normalized === "refund") {
    return { lifecycleStatus: "Refunded", paymentStatus: PaymentStatus.FAILED };
  }
  if (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return { lifecycleStatus: "Failed", paymentStatus: PaymentStatus.FAILED };
  }
  if (normalized === "unpaid") {
    return { lifecycleStatus: "Unpaid", paymentStatus: PaymentStatus.PENDING };
  }
  if (normalized === "pending" || normalized === "processing") {
    return { lifecycleStatus: "Pending", paymentStatus: PaymentStatus.PENDING };
  }
  return { lifecycleStatus: "Unknown", paymentStatus: PaymentStatus.PENDING };
}

function extractStatusRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
  const data = payload.data;
  if (Array.isArray(data) && data.length > 0) {
    return asRecord(data[0]);
  }
  return asRecord(data);
}

function parseStatusPayload(
  payload: Record<string, unknown>,
  requestedReference: string,
): HubtelVerifiedTransaction {
  const record = extractStatusRecord(payload);
  if (!record) {
    throw new HubtelStatusRequestError("Hubtel status response is missing data.", {
      retryable: false,
    });
  }

  const rawStatus = pickString(record, [
    "status",
    "Status",
    "transactionStatus",
    "TransactionStatus",
  ]);
  const { lifecycleStatus, paymentStatus } = mapHubtelLifecycleStatus(rawStatus);

  const clientReference =
    pickString(record, ["clientReference", "ClientReference"]) ??
    requestedReference;

  const providerReference =
    pickString(record, [
      "transactionId",
      "TransactionId",
      "externalTransactionId",
      "ExternalTransactionId",
      "id",
      "Id",
    ]) ?? clientReference;

  return {
    status: paymentStatus,
    lifecycleStatus,
    clientReference,
    providerReference,
    amount: parseAmount(
      record.amount ?? record.Amount ?? record.totalAmount ?? record.TotalAmount,
    ),
    currency: pickString(record, ["currency", "Currency"]),
    paidAt: parsePaidAt(
      record.date ??
        record.Date ??
        record.paymentDate ??
        record.PaymentDate ??
        record.paidAt,
    ),
    rawStatus,
  };
}

/**
 * Server-side Hubtel transaction status lookup.
 * Never treat browser/callback claims as authoritative — callers must use this.
 */
export async function hubtelFetchTransactionStatus(
  clientReference: string,
  configOverride?: HubtelPaymentConfig,
): Promise<HubtelVerifiedTransaction> {
  const trimmed = clientReference.trim();
  if (!trimmed) {
    throw new HubtelStatusRequestError("clientReference is required.", {
      retryable: false,
    });
  }

  const config = configOverride ?? getHubtelPaymentConfig();
  const url = buildHubtelTransactionStatusUrl(
    trimmed,
    config.HUBTEL_COLLECTION_ACCOUNT_NUMBER,
  );

  console.info("[hubtel:status] fetch", {
    clientReference: trimmed,
    merchantAccountNumber: config.HUBTEL_COLLECTION_ACCOUNT_NUMBER,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: buildHubtelPaymentBasicAuthHeader(
          config.HUBTEL_PAYMENT_API_ID,
          config.HUBTEL_PAYMENT_API_KEY,
        ),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(HUBTEL_STATUS_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    console.error("[hubtel:status] request failed", {
      clientReference: trimmed,
      error: sanitizeHubtelErrorBody(message),
    });
    throw new HubtelStatusRequestError(
      "Unable to reach Hubtel transaction status service.",
      { retryable: true },
    );
  }

  const responseText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    console.error("[hubtel:status] invalid JSON", {
      clientReference: trimmed,
      httpStatus: response.status,
      responseBody: sanitizeHubtelErrorBody(responseText),
    });
    throw new HubtelStatusRequestError(
      "Hubtel returned an invalid status response.",
      { retryable: true },
    );
  }

  if (!response.ok) {
    console.error("[hubtel:status] http error", {
      clientReference: trimmed,
      httpStatus: response.status,
      responseBody: sanitizeHubtelErrorBody(responseText),
    });
    throw new HubtelStatusRequestError(
      typeof payload.message === "string"
        ? payload.message
        : "Hubtel status request failed.",
      { retryable: response.status >= 500 || response.status === 429 },
    );
  }

  return parseStatusPayload(payload, trimmed);
}
