import { PAYMENT_ABANDONMENT_HOURS } from "@/lib/payments/lifecycle";

/**
 * Safe recovery guidance for orphan PENDING payments created when Hubtel
 * checkout initiation fails or times out after the Firestore pending row exists.
 *
 * This module is documentation + constants only — it does not mutate payments.
 */
export const ORPHAN_PENDING_RECOVERY = {
  /** Never mark an uncertain initiate failure as FAILED automatically. */
  doNotAutoFail: true,
  /** Never blind-retry Hubtel initiate for the same clientReference. */
  doNotBlindRetrySameReference: true,
  /**
   * Prefer server-side status verification (Check status / callback) in case
   * Hubtel accepted the checkout despite a portal timeout.
   */
  preferStatusVerification: true,
  /** Unresolved PENDING rows are abandoned after this many hours. */
  abandonmentHours: PAYMENT_ABANDONMENT_HOURS,
  operatorGuidance: [
    "Inspect Payment History for the pending reference before starting another checkout.",
    "Use Check status / verify to ask Hubtel whether the reference was Paid.",
    "If Hubtel confirms Paid, settlement creates contribution/receipt idempotently.",
    "If Hubtel never shows Paid and the member was not charged, wait for abandonment or record a manual admin contribution after finance confirmation.",
    "Do not treat a Hubtel initiate timeout alone as proof of non-payment.",
  ],
} as const;

export function describeOrphanPendingRecovery(): string {
  return ORPHAN_PENDING_RECOVERY.operatorGuidance.join(" ");
}
