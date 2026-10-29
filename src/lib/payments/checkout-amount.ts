import type { SerializedPayment } from "@/types/payment";

const MAJOR_UNIT_SCALE = 100;

/**
 * Round major-unit amounts to two decimal places (pesewa precision).
 * Matches display/formatting conventions used across the portal.
 */
export function roundMajorCurrencyAmount(value: number): number {
  return Math.round(value * MAJOR_UNIT_SCALE) / MAJOR_UNIT_SCALE;
}

export type CheckoutAmountBreakdown = {
  /** Official welfare contribution amount. */
  amount: number;
  /** Amount sent to / verified against Hubtel. */
  checkoutAmount: number;
  /** checkoutAmount − amount; never recorded as dues. */
  processingFeeAmount: number;
};

/**
 * Server-side checkout breakdown for Hubtel Online Checkout.
 *
 * Phase 1: no surcharge. checkoutAmount equals the official contribution and
 * processingFeeAmount is always 0. Future phases may accept a defined fee
 * configuration; do not invent rates here.
 *
 * Never trust a browser-supplied checkout total — callers must pass the
 * server-resolved official contribution amount only.
 */
export function resolveCheckoutAmountBreakdown(
  officialAmount: number,
): CheckoutAmountBreakdown {
  if (!Number.isFinite(officialAmount) || officialAmount <= 0) {
    throw new Error("Official contribution amount must be a positive number.");
  }

  const amount = roundMajorCurrencyAmount(officialAmount);
  if (amount <= 0) {
    throw new Error("Official contribution amount must be a positive number.");
  }

  return {
    amount,
    checkoutAmount: amount,
    processingFeeAmount: 0,
  };
}

/**
 * Expected Hubtel verification amount: stored checkoutAmount when present,
 * otherwise legacy fallback to official `amount`.
 */
export function resolveExpectedCheckoutAmount(
  payment: Pick<SerializedPayment, "amount" | "checkoutAmount">,
): number {
  if (
    payment.checkoutAmount != null &&
    Number.isFinite(payment.checkoutAmount)
  ) {
    return payment.checkoutAmount;
  }
  return payment.amount;
}
