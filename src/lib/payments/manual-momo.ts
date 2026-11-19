/**
 * Legacy Mobile Money account constants.
 *
 * Member-facing manual MoMo checkout instructions were removed in Phase 3.
 * Online member payments use Hubtel Checkout only when enabled and configured.
 * Finance/admin staff continue to record externally confirmed MoMo (and other)
 * contributions through `/admin/contributions`.
 *
 * Do not re-expose these details on member payment screens without review.
 */

export const MANUAL_MOMO_ACCOUNT = {
  network: "MTN",
  number: "0538815177",
  accountName: "Public Square / Benjamin Samason",
} as const;

/** @deprecated Member-facing MoMo panel removed; kept for historical test/reference. */
export const MANUAL_MOMO_SECTION_TITLE = "Pay Directly via Mobile Money" as const;

/** @deprecated Member-facing MoMo panel removed; kept for historical test/reference. */
export const MANUAL_MOMO_INSTRUCTIONS =
  "Please transfer your contribution to the Mobile Money account shown above. Use your GIS service number as the payment reference so the Finance Team can identify your payment. Your contribution will be recorded manually after the payment has been confirmed." as const;

export type ContributionPaymentMode = "online" | "unavailable";

/**
 * Member contribution checkout mode.
 * Online requires PAYMENTS_ENABLED=true; otherwise checkout is unavailable
 * (no member-facing manual MoMo fallback).
 */
export function getContributionPaymentMode(): ContributionPaymentMode {
  return process.env.PAYMENTS_ENABLED === "true" ? "online" : "unavailable";
}

/** @deprecated Use getContributionPaymentMode() === "unavailable". */
export function isManualMomoContributionMode(): boolean {
  return false;
}
