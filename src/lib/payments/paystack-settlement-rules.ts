import {
  normalizePaystackCurrency,
  toPaystackMinorUnits,
} from "@/lib/integrations/paystack/webhook-signature";
import type { PaystackVerifiedTransaction } from "@/lib/integrations/paystack/client";
import { PaymentStatus } from "@/types/enums";
import type { SerializedPayment } from "@/types/payment";

export class PaymentSettlementError extends Error {
  /**
   * When true, webhook delivery should be acknowledged as retryable (non-2xx)
   * so Paystack can retry. Validation/business mismatches are permanent (false).
   */
  readonly retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "PaymentSettlementError";
    this.retryable = options?.retryable ?? false;
  }
}

export function validatePaystackReference(
  expectedReference: string,
  providerReference: string,
): void {
  if (providerReference !== expectedReference) {
    throw new PaymentSettlementError(
      "Paystack reference does not match the expected payment reference.",
    );
  }
}

export function resolvePaystackBusinessAmountMinor(
  verification: Pick<
    PaystackVerifiedTransaction,
    "amount" | "requestedAmount" | "fees"
  >,
): number {
  if (verification.requestedAmount != null) {
    return verification.requestedAmount;
  }
  if (verification.fees != null) {
    return verification.amount - verification.fees;
  }
  return verification.amount;
}

export function validatePaystackBusinessAmount(
  payment: Pick<SerializedPayment, "amount">,
  verification: Pick<
    PaystackVerifiedTransaction,
    "amount" | "requestedAmount" | "fees"
  >,
): void {
  const expectedMinor = toPaystackMinorUnits(payment.amount);
  const businessMinor = resolvePaystackBusinessAmountMinor(verification);

  if (businessMinor < expectedMinor) {
    throw new PaymentSettlementError(
      "Paystack amount does not match the expected payment amount.",
    );
  }

  if (businessMinor !== expectedMinor) {
    throw new PaymentSettlementError(
      "Paystack amount does not match the expected payment amount.",
    );
  }
}

export function validatePaystackCurrency(
  payment: Pick<SerializedPayment, "currency">,
  paystackCurrency: string,
): void {
  if (
    normalizePaystackCurrency(paystackCurrency) !==
    normalizePaystackCurrency(payment.currency)
  ) {
    throw new PaymentSettlementError(
      "Paystack currency does not match the expected payment currency.",
    );
  }
}

export type PaystackSettlementMismatchIssue = "reference" | "amount" | "currency";

export type PaystackSettlementMatch =
  | { consistent: true }
  | { consistent: false; issue: "status" | PaystackSettlementMismatchIssue };

/**
 * Read-only application of the canonical settlement match rules.
 * Does not verify with Paystack and does not write payment records.
 */
export function assessPaystackSettlementMatch(
  payment: Pick<SerializedPayment, "reference" | "amount" | "currency">,
  verification: PaystackVerifiedTransaction,
): PaystackSettlementMatch {
  if (verification.status !== PaymentStatus.SUCCESS) {
    return { consistent: false, issue: "status" };
  }

  try {
    validatePaystackReference(payment.reference, verification.providerReference);
    validatePaystackBusinessAmount(payment, verification);
    validatePaystackCurrency(payment, verification.currency);
  } catch (error) {
    if (!(error instanceof PaymentSettlementError)) {
      throw error;
    }
    if (error.message.includes("reference")) {
      return { consistent: false, issue: "reference" };
    }
    if (error.message.includes("currency")) {
      return { consistent: false, issue: "currency" };
    }
    return { consistent: false, issue: "amount" };
  }

  return { consistent: true };
}
