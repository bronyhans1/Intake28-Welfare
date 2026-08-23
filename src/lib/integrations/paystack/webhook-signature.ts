import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";
import { PaystackConfigurationError } from "@/lib/integrations/paystack/client";

function getPaystackSecretKey(): string {
  const secretKey = env.server().PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new PaystackConfigurationError();
  }
  return secretKey;
}

/** Convert internal GHS major units to Paystack pesewas (minor units). */
export function toPaystackMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

export function normalizePaystackCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

/**
 * Validate Paystack webhook `x-paystack-signature` against the raw request body.
 * Uses HMAC SHA512 with PAYSTACK_SECRET_KEY.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.trim()) {
    return false;
  }

  const expected = createHmac("sha512", getPaystackSecretKey())
    .update(rawBody)
    .digest("hex");

  const received = signatureHeader.trim();

  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(received, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
