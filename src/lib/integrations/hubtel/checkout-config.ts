import { z } from "zod";
import { emptyToUndefined } from "@/config/env-helpers";

/** Production Accra collection account confirmed for Online Checkout. */
export const HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER = "2040955" as const;

export const HUBTEL_CHECKOUT_INITIATE_URL =
  "https://payproxyapi.hubtel.com/items/initiate" as const;

/**
 * Transaction status URL template (Phase 2+). Not called during initiation.
 * {clientReference} is URL-encoded by helpers when used.
 */
export const HUBTEL_TRANSACTION_STATUS_URL_TEMPLATE =
  "https://rmsc.hubtel.com/v1/merchantaccount/merchants/{COLLECTION_ACCOUNT_NUMBER}/transactions/status" as const;

const hubtelPaymentEnvSchema = z.object({
  HUBTEL_PAYMENT_API_ID: z.string().min(1),
  HUBTEL_PAYMENT_API_KEY: z.string().min(1),
  HUBTEL_COLLECTION_ACCOUNT_NUMBER: z
    .string()
    .min(1)
    .default(HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER),
});

export type HubtelPaymentConfig = {
  HUBTEL_PAYMENT_API_ID: string;
  HUBTEL_PAYMENT_API_KEY: string;
  HUBTEL_COLLECTION_ACCOUNT_NUMBER: string;
};

export class HubtelPaymentConfigurationError extends Error {
  constructor(message = "Hubtel Online Checkout is not configured.") {
    super(message);
    this.name = "HubtelPaymentConfigurationError";
  }
}

export function isHubtelPaymentConfigured(): boolean {
  return Boolean(
    process.env.HUBTEL_PAYMENT_API_ID?.trim() &&
      process.env.HUBTEL_PAYMENT_API_KEY?.trim(),
  );
}

/**
 * Server-only Payment API credentials. Separate from Hubtel SMS/OTP env vars.
 */
export function getHubtelPaymentConfig(): HubtelPaymentConfig {
  const parsed = hubtelPaymentEnvSchema.safeParse({
    HUBTEL_PAYMENT_API_ID: emptyToUndefined(process.env.HUBTEL_PAYMENT_API_ID),
    HUBTEL_PAYMENT_API_KEY: emptyToUndefined(process.env.HUBTEL_PAYMENT_API_KEY),
    HUBTEL_COLLECTION_ACCOUNT_NUMBER:
      emptyToUndefined(process.env.HUBTEL_COLLECTION_ACCOUNT_NUMBER) ??
      HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER,
  });

  if (!parsed.success) {
    throw new HubtelPaymentConfigurationError();
  }

  return parsed.data;
}

export function buildHubtelTransactionStatusUrl(
  clientReference: string,
  collectionAccountNumber: string = HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER,
): string {
  const base = HUBTEL_TRANSACTION_STATUS_URL_TEMPLATE.replace(
    "{COLLECTION_ACCOUNT_NUMBER}",
    encodeURIComponent(collectionAccountNumber),
  );
  const url = new URL(base);
  url.searchParams.set("clientReference", clientReference);
  return url.toString();
}
