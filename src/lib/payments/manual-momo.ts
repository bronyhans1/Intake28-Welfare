/**
 * Temporary direct Mobile Money contribution instructions.
 *
 * Presentation mode follows the existing Paystack initiation gate:
 * - Online checkout UI when PAYMENTS_ENABLED === "true"
 * - Manual MoMo instructions otherwise (fail-closed / suspension)
 *
 * Reverse by setting PAYMENTS_ENABLED=true in the hosting environment.
 * Do not delete Paystack initialize/verify/webhook/recovery code.
 */

import { isPaymentsEnabled } from "@/lib/payments/availability";

/** Association MoMo receiving account — edit here only. */
export const MANUAL_MOMO_ACCOUNT = {
  network: "MTN",
  number: "0538815177",
  accountName: "Public Square / Benjamin Samason",
} as const;

export const MANUAL_MOMO_SECTION_TITLE = "Pay Directly via Mobile Money" as const;

export const MANUAL_MOMO_INSTRUCTIONS =
  "Please transfer your contribution to the Mobile Money account shown above. Use your GIS service number as the payment reference so the Finance Team can identify your payment. Your contribution will be recorded manually after the payment has been confirmed." as const;

export type ContributionPaymentMode = "online" | "manual_momo";

/**
 * Member-facing contribution checkout mode.
 * Online requires an explicit PAYMENTS_ENABLED=true; anything else is manual MoMo.
 */
export function getContributionPaymentMode(): ContributionPaymentMode {
  return isPaymentsEnabled() ? "online" : "manual_momo";
}

export function isManualMomoContributionMode(): boolean {
  return getContributionPaymentMode() === "manual_momo";
}
