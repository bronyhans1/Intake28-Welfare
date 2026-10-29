import {
  buildHubtelTransactionStatusUrl,
  getHubtelPaymentConfig,
  HUBTEL_CHECKOUT_INITIATE_URL,
  HubtelPaymentConfigurationError,
  type HubtelPaymentConfig,
} from "@/lib/integrations/hubtel/checkout-config";

export { buildHubtelTransactionStatusUrl, HubtelPaymentConfigurationError };
export {
  HUBTEL_CHECKOUT_INITIATE_URL,
  HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER,
  HUBTEL_TRANSACTION_STATUS_URL_TEMPLATE,
  getHubtelPaymentConfig,
  isHubtelPaymentConfigured,
} from "@/lib/integrations/hubtel/checkout-config";

const HUBTEL_CHECKOUT_TIMEOUT_MS = 20_000;
const HUBTEL_ERROR_BODY_LOG_LIMIT = 400;

/** Hubtel clientReference max length (merchant docs). */
export const HUBTEL_CLIENT_REFERENCE_MAX_LENGTH = 32;

export class HubtelCheckoutRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubtelCheckoutRequestError";
  }
}

export interface HubtelInitiateCheckoutInput {
  totalAmount: number;
  description: string;
  callbackUrl: string;
  returnUrl: string;
  cancellationUrl: string;
  clientReference: string;
  merchantAccountNumber?: string;
}

export interface HubtelInitiateCheckoutResult {
  checkoutUrl: string;
  clientReference: string;
  checkoutId: string | null;
}

/**
 * Builds HTTP Basic Authorization header value.
 * Does not log credentials.
 */
export function buildHubtelPaymentBasicAuthHeader(
  paymentApiId: string,
  paymentApiKey: string,
): string {
  const token = Buffer.from(
    `${paymentApiId}:${paymentApiKey}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function assertSafeHttpUrl(value: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HubtelCheckoutRequestError(`Invalid ${label}.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HubtelCheckoutRequestError(`Invalid ${label} protocol.`);
  }
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

function extractCheckoutUrl(data: Record<string, unknown>): string | null {
  for (const key of ["checkoutUrl", "checkoutDirectUrl", "CheckoutUrl"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function extractCheckoutId(data: Record<string, unknown>): string | null {
  for (const key of ["checkoutId", "CheckoutId"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isSuccessfulInitiateResponse(
  responseCode: unknown,
  status: unknown,
): boolean {
  const code = typeof responseCode === "string" ? responseCode : "";
  const statusText = typeof status === "string" ? status.toLowerCase() : "";
  // Hubtel commonly uses 0000 / 0001 for accepted checkout initiation.
  if (code === "0000" || code === "0001") {
    return true;
  }
  return statusText === "success" || statusText === "ok";
}

/**
 * Initiates Hubtel Online Checkout. Server-only.
 * Does not mark payments successful and does not create contributions/receipts.
 */
export async function hubtelInitiateCheckout(
  input: HubtelInitiateCheckoutInput,
  configOverride?: HubtelPaymentConfig,
): Promise<HubtelInitiateCheckoutResult> {
  if (
    !input.clientReference ||
    input.clientReference.length > HUBTEL_CLIENT_REFERENCE_MAX_LENGTH
  ) {
    throw new HubtelCheckoutRequestError(
      `clientReference must be 1–${HUBTEL_CLIENT_REFERENCE_MAX_LENGTH} characters.`,
    );
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new HubtelCheckoutRequestError("totalAmount must be a positive number.");
  }
  if (!input.description.trim()) {
    throw new HubtelCheckoutRequestError("description is required.");
  }

  assertSafeHttpUrl(input.callbackUrl, "callbackUrl");
  assertSafeHttpUrl(input.returnUrl, "returnUrl");
  assertSafeHttpUrl(input.cancellationUrl, "cancellationUrl");

  const config = configOverride ?? getHubtelPaymentConfig();
  const merchantAccountNumber =
    input.merchantAccountNumber?.trim() ||
    config.HUBTEL_COLLECTION_ACCOUNT_NUMBER;

  const requestBody = {
    totalAmount: input.totalAmount,
    description: input.description.trim(),
    callbackUrl: input.callbackUrl,
    returnUrl: input.returnUrl,
    merchantAccountNumber,
    cancellationUrl: input.cancellationUrl,
    clientReference: input.clientReference,
  };

  console.info("[hubtel:checkout] initiate", {
    clientReference: input.clientReference,
    merchantAccountNumber,
    totalAmount: input.totalAmount,
  });

  let response: Response;
  try {
    response = await fetch(HUBTEL_CHECKOUT_INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: buildHubtelPaymentBasicAuthHeader(
          config.HUBTEL_PAYMENT_API_ID,
          config.HUBTEL_PAYMENT_API_KEY,
        ),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(HUBTEL_CHECKOUT_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    console.error("[hubtel:checkout] request failed", {
      clientReference: input.clientReference,
      error: sanitizeHubtelErrorBody(message),
    });
    throw new HubtelCheckoutRequestError(
      "Unable to reach Hubtel checkout. Please try again later.",
    );
  }

  const responseText = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    console.error("[hubtel:checkout] invalid JSON", {
      clientReference: input.clientReference,
      httpStatus: response.status,
      responseBody: sanitizeHubtelErrorBody(responseText),
    });
    throw new HubtelCheckoutRequestError(
      "Hubtel returned an invalid checkout response.",
    );
  }

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const checkoutUrl = data ? extractCheckoutUrl(data) : null;

  if (
    !response.ok ||
    !data ||
    !checkoutUrl ||
    !isSuccessfulInitiateResponse(payload.responseCode, payload.status)
  ) {
    const message =
      (typeof payload.message === "string" && payload.message) ||
      (typeof payload.status === "string" && payload.status) ||
      "Failed to initiate Hubtel checkout.";
    console.error("[hubtel:checkout] initiate rejected", {
      clientReference: input.clientReference,
      httpStatus: response.status,
      responseCode: payload.responseCode ?? null,
      responseBody: sanitizeHubtelErrorBody(responseText),
    });
    throw new HubtelCheckoutRequestError(message);
  }

  assertSafeHttpUrl(checkoutUrl, "checkoutUrl");

  return {
    checkoutUrl,
    clientReference:
      (typeof data.clientReference === "string" && data.clientReference) ||
      input.clientReference,
    checkoutId: extractCheckoutId(data),
  };
}
