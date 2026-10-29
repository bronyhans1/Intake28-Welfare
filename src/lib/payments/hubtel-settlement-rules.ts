import { PaymentSettlementError } from "@/lib/payments/paystack-settlement-rules";
import { resolveExpectedCheckoutAmount } from "@/lib/payments/checkout-amount";
import type { HubtelVerifiedTransaction } from "@/lib/integrations/hubtel/status";
import type { SerializedPayment } from "@/types/payment";

const AMOUNT_TOLERANCE = 0.005;

export function validateHubtelReference(
  expectedReference: string,
  verifiedClientReference: string,
): void {
  if (verifiedClientReference.trim() !== expectedReference.trim()) {
    throw new PaymentSettlementError(
      "Hubtel clientReference does not match the expected payment reference.",
    );
  }
}

/**
 * Compare Hubtel status amount to the server-stored expected checkout total.
 * expectedCheckoutAmount = payment.checkoutAmount ?? payment.amount
 *
 * Do not compare against an arbitrary surcharge — only the persisted checkout
 * amount (or legacy official amount) is accepted.
 */
export function validateHubtelAmount(
  payment: Pick<SerializedPayment, "amount" | "checkoutAmount">,
  verification: Pick<HubtelVerifiedTransaction, "amount">,
): void {
  if (verification.amount == null || !Number.isFinite(verification.amount)) {
    throw new PaymentSettlementError(
      "Hubtel status response is missing a transaction amount.",
    );
  }
  const expectedCheckoutAmount = resolveExpectedCheckoutAmount(payment);
  if (!Number.isFinite(expectedCheckoutAmount)) {
    throw new PaymentSettlementError(
      "Hubtel amount does not match the expected payment amount.",
    );
  }
  if (Math.abs(verification.amount - expectedCheckoutAmount) > AMOUNT_TOLERANCE) {
    throw new PaymentSettlementError(
      "Hubtel amount does not match the expected payment amount.",
    );
  }
}

export function validateHubtelCurrency(
  payment: Pick<SerializedPayment, "currency">,
  hubtelCurrency: string | null,
): void {
  if (!hubtelCurrency) {
    // Currency is optional in Hubtel status payloads; skip when absent.
    return;
  }
  if (
    hubtelCurrency.trim().toUpperCase() !==
    String(payment.currency ?? "").trim().toUpperCase()
  ) {
    throw new PaymentSettlementError(
      "Hubtel currency does not match the expected payment currency.",
    );
  }
}
