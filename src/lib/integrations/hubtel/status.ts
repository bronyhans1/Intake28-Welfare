import {
  buildHubtelTransactionStatusUrl,
  getHubtelPaymentConfig,
  type HubtelPaymentConfig,
} from "@/lib/integrations/hubtel/checkout-config";
import { buildHubtelPaymentBasicAuthHeader } from "@/lib/integrations/hubtel/checkout";
import { PaymentStatus } from "@/types/enums";

const HUBTEL_STATUS_TIMEOUT_MS = 20_000;
const HUBTEL_ERROR_BODY_LOG_LIMIT = 400;

/** Documented Hubtel RMSC response when clientReference has no matching transaction. */
export const HUBTEL_NO_RECORD_RESPONSE_CODE = "4720";

const HUBTEL_NO_RECORD_MESSAGE_PATTERN =
  /did not match any records|older than (?:a|one) month/i;

export type HubtelStatusErrorKind = "no_record" | "http" | "network" | "parse";

export class HubtelStatusRequestError extends Error {
  readonly retryable: boolean;
  readonly kind: HubtelStatusErrorKind | null;
  readonly responseCode: string | null;
  readonly httpStatus: number | null;

  constructor(
    message: string,
    options?: {
      retryable?: boolean;
      kind?: HubtelStatusErrorKind | null;
      responseCode?: string | null;
      httpStatus?: number | null;
    },
  ) {
    super(message);
    this.name = "HubtelStatusRequestError";
    this.retryable = options?.retryable ?? true;
    this.kind = options?.kind ?? null;
    this.responseCode = options?.responseCode ?? null;
    this.httpStatus = options?.httpStatus ?? null;
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

export function resolveHubtelStatusResponseCode(
  payload: Record<string, unknown>,
): string | null {
  return pickString(payload, ["responseCode", "ResponseCode", "code", "Code"]);
}

/**
 * True only for HTTP 400 no-record outcomes.
 * Prefer structured response code `4720`; fall back to the documented message
 * only when no response code is present (never remap unrelated 400 codes).
 */
export function isHubtelNoRecordCondition(input: {
  httpStatus: number;
  responseCode: string | null;
  message: string | null;
}): boolean {
  if (input.httpStatus !== 400) {
    return false;
  }
  if (input.responseCode === HUBTEL_NO_RECORD_RESPONSE_CODE) {
    return true;
  }
  if (input.responseCode != null && input.responseCode !== "") {
    return false;
  }
  return Boolean(
    input.message && HUBTEL_NO_RECORD_MESSAGE_PATTERN.test(input.message),
  );
}

export function isHubtelNoRecordStatusError(
  error: unknown,
): error is HubtelStatusRequestError {
  return (
    error instanceof HubtelStatusRequestError && error.kind === "no_record"
  );
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

/**
 * Resolve Hubtel status envelope payload. Prefer explicit `data` (even when
 * null) over `Data` so nullish coalescing does not hide a present null field.
 */
function resolveEnvelopeData(payload: Record<string, unknown>): unknown {
  if (Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "Data")) {
    return payload.Data;
  }
  return undefined;
}

const AMOUNT_FIELD_ALIASES = [
  "amount",
  "Amount",
  "totalAmount",
  "TotalAmount",
  /** Confirmed RMSC Public Transaction Status Check field (major units). */
  "TransactionAmount",
] as const;

type StatusRecordNestingLevel =
  | "envelope_data_array_element0"
  | "envelope_data_object"
  | "unavailable";

/**
 * Hubtel status envelopes may use `data` or `Data`. Nested shape follows the
 * existing contract: a non-empty array (first object) or a single object.
 */
function extractStatusRecord(payload: Record<string, unknown>): {
  record: Record<string, unknown> | null;
  nestingLevel: StatusRecordNestingLevel;
} {
  const data = resolveEnvelopeData(payload);
  if (Array.isArray(data) && data.length > 0) {
    return {
      record: asRecord(data[0]),
      nestingLevel: "envelope_data_array_element0",
    };
  }
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return {
      record: asRecord(data),
      nestingLevel: "envelope_data_object",
    };
  }
  return { record: asRecord(data), nestingLevel: "unavailable" };
}

/**
 * Safe metadata when a transaction record was found but amount aliases resolve
 * to null. Never logs amount values or response bodies.
 */
function buildMissingAmountDiagnostics(input: {
  envelope: Record<string, unknown>;
  record: Record<string, unknown>;
  nestingLevel: StatusRecordNestingLevel;
}): Record<string, unknown> {
  const { envelope, record, nestingLevel } = input;

  let firstPresentAlias: string | null = null;
  let resolvedAmountKind: string | null = null;
  for (const key of AMOUNT_FIELD_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      firstPresentAlias = key;
      resolvedAmountKind = jsonValueKind(record[key]);
      break;
    }
  }

  return {
    topLevelKeys: Object.keys(envelope).sort(),
    nestingLevel,
    recordKeys: Object.keys(record).sort(),
    hasAmount: Object.prototype.hasOwnProperty.call(record, "amount"),
    hasPascalAmount: Object.prototype.hasOwnProperty.call(record, "Amount"),
    hasTotalAmount: Object.prototype.hasOwnProperty.call(record, "totalAmount"),
    hasPascalTotalAmount: Object.prototype.hasOwnProperty.call(
      record,
      "TotalAmount",
    ),
    hasTransactionAmount: Object.prototype.hasOwnProperty.call(
      record,
      "TransactionAmount",
    ),
    firstPresentAmountAlias: firstPresentAlias,
    resolvedAmountKind,
    envelopeHasAmount: Object.prototype.hasOwnProperty.call(envelope, "amount"),
    envelopeHasPascalAmount: Object.prototype.hasOwnProperty.call(
      envelope,
      "Amount",
    ),
  };
}

function jsonValueKind(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Safe shape metadata for HTTP-success parse failures.
 * Never logs body contents, credentials, or Hubtel message text.
 */
function buildMissingDataDiagnostics(input: {
  httpStatus: number;
  contentType: string | null;
  parsed: unknown;
}): Record<string, unknown> {
  const { httpStatus, contentType, parsed } = input;

  if (parsed === null || typeof parsed !== "object") {
    return {
      httpStatus,
      contentType,
      payloadType: jsonValueKind(parsed),
      topLevelKeys: null,
      dataType: null,
      dataIsNull: null,
      dataArrayLength: null,
      hasResponseCode: false,
      responseCodeType: null,
      hasMessage: false,
      messageType: null,
    };
  }

  if (Array.isArray(parsed)) {
    return {
      httpStatus,
      contentType,
      payloadType: "array",
      topLevelKeys: null,
      dataType: null,
      dataIsNull: null,
      dataArrayLength: parsed.length,
      hasResponseCode: false,
      responseCodeType: null,
      hasMessage: false,
      messageType: null,
    };
  }

  const payload = parsed as Record<string, unknown>;
  const data = resolveEnvelopeData(payload);
  const hasResponseCode =
    Object.prototype.hasOwnProperty.call(payload, "responseCode") ||
    Object.prototype.hasOwnProperty.call(payload, "ResponseCode");
  const responseCodeValue = Object.prototype.hasOwnProperty.call(
    payload,
    "responseCode",
  )
    ? payload.responseCode
    : payload.ResponseCode;
  const hasMessage =
    Object.prototype.hasOwnProperty.call(payload, "message") ||
    Object.prototype.hasOwnProperty.call(payload, "Message");
  const messageValue = Object.prototype.hasOwnProperty.call(payload, "message")
    ? payload.message
    : payload.Message;

  return {
    httpStatus,
    contentType,
    payloadType: "object",
    topLevelKeys: Object.keys(payload).sort(),
    dataType: jsonValueKind(data),
    dataIsNull: data === null,
    dataArrayLength: Array.isArray(data) ? data.length : null,
    hasResponseCode,
    responseCodeType: hasResponseCode ? jsonValueKind(responseCodeValue) : null,
    hasMessage,
    messageType: hasMessage ? jsonValueKind(messageValue) : null,
  };
}

function parseStatusPayload(
  payload: Record<string, unknown>,
  requestedReference: string,
): HubtelVerifiedTransaction {
  const { record, nestingLevel } = extractStatusRecord(payload);
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

  // Prefer legacy aliases first; then confirmed RMSC TransactionAmount.
  // Do not use AmountAfterFees or Fee — those are not the member checkout total.
  const amount = parseAmount(
    record.amount ??
      record.Amount ??
      record.totalAmount ??
      record.TotalAmount ??
      record.TransactionAmount,
  );

  if (amount == null) {
    console.error(
      "[hubtel:status] missing amount",
      buildMissingAmountDiagnostics({
        envelope: payload,
        record,
        nestingLevel,
      }),
    );
  }

  return {
    status: paymentStatus,
    lifecycleStatus,
    clientReference,
    providerReference,
    amount,
    currency: pickString(record, ["currency", "Currency", "CurrencyCode"]),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText) as unknown;
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

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    const errorPayload = asRecord(parsed) ?? {};
    const responseCode = resolveHubtelStatusResponseCode(errorPayload);
    const message =
      typeof errorPayload.message === "string"
        ? errorPayload.message
        : typeof errorPayload.Message === "string"
          ? errorPayload.Message
          : "Hubtel status request failed.";
    const noRecord = isHubtelNoRecordCondition({
      httpStatus: response.status,
      responseCode,
      message,
    });

    console.error(
      `[hubtel:status] http error httpStatus=${response.status} responseCode=${responseCode ?? "none"} kind=${noRecord ? "no_record" : "http"} clientReference=${trimmed}`,
    );

    throw new HubtelStatusRequestError(message, {
      retryable: noRecord
        ? false
        : response.status >= 500 || response.status === 429,
      kind: noRecord ? "no_record" : "http",
      responseCode,
      httpStatus: response.status,
    });
  }

  // HTTP success — reuse the single parsed value; do not re-parse responseText.
  const payload = asRecord(parsed);
  if (!payload) {
    console.error(
      "[hubtel:status] missing data",
      buildMissingDataDiagnostics({
        httpStatus: response.status,
        contentType,
        parsed,
      }),
    );
    throw new HubtelStatusRequestError("Hubtel status response is missing data.", {
      retryable: false,
    });
  }

  try {
    return parseStatusPayload(payload, trimmed);
  } catch (error) {
    if (
      error instanceof HubtelStatusRequestError &&
      error.message === "Hubtel status response is missing data."
    ) {
      console.error(
        "[hubtel:status] missing data",
        buildMissingDataDiagnostics({
          httpStatus: response.status,
          contentType,
          parsed,
        }),
      );
    }
    throw error;
  }
}
