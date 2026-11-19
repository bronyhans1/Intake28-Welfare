import type { SerializedPayment } from "@/types/payment";

const MAJOR_UNIT_SCALE = 100;

/**
 * Hubtel Online Checkout processing fee as a percent of the official
 * contribution amount (2%). Added server-side — Hubtel does not auto-add this.
 * Never treated as dues / ledger contribution.
 */
export const HUBTEL_ONLINE_CHECKOUT_PROCESSING_FEE_PERCENT = 2;

/**
 * Round major-unit amounts to two decimal places (pesewa precision).
 * Matches display/formatting conventions used across the portal.
 */
export function roundMajorCurrencyAmount(value: number): number {
  return Math.round(value * MAJOR_UNIT_SCALE) / MAJOR_UNIT_SCALE;
}

/**
 * Convert a major-unit GHS amount to integer pesewas (nearest pesewa).
 */
export function toPesewas(majorUnits: number): number {
  return Math.round(majorUnits * MAJOR_UNIT_SCALE);
}

/**
 * Convert integer pesewas to major-unit GHS.
 */
export function fromPesewas(pesewas: number): number {
  return pesewas / MAJOR_UNIT_SCALE;
}

/**
 * 2% of contribution in pesewas, rounded to the nearest pesewa
 * (half away from zero via Math.round on the scaled product).
 *
 * feePesewas = round((amountPesewas × 2) / 100)
 */
export function calculateHubtelProcessingFeePesewas(
  amountPesewas: number,
): number {
  if (!Number.isInteger(amountPesewas) || amountPesewas <= 0) {
    throw new Error("Contribution amount in pesewas must be a positive integer.");
  }
  return Math.round(
    (amountPesewas * HUBTEL_ONLINE_CHECKOUT_PROCESSING_FEE_PERCENT) / 100,
  );
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
 * processingFeeAmount = 2% of amount (nearest-pesewa rounding in integer math).
 * checkoutAmount = amount + processingFeeAmount.
 * Official contribution (`amount`) remains the welfare ledger value.
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

  const amountPesewas = toPesewas(officialAmount);
  if (amountPesewas <= 0) {
    throw new Error("Official contribution amount must be a positive number.");
  }

  const processingFeePesewas =
    calculateHubtelProcessingFeePesewas(amountPesewas);
  const checkoutPesewas = amountPesewas + processingFeePesewas;

  return {
    amount: fromPesewas(amountPesewas),
    processingFeeAmount: fromPesewas(processingFeePesewas),
    checkoutAmount: fromPesewas(checkoutPesewas),
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
