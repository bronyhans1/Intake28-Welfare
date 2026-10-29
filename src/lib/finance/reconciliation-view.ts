import type { SerializedContribution } from "@/types/contribution";
import type { PaymentStatus } from "@/types/enums";
import type { SerializedPayment } from "@/types/payment";
import type { SerializedReceipt } from "@/types/receipt";

/** Hard cap so one reconciliation batch cannot verify every historical payment. */
export const PAYSTACK_RECONCILIATION_VERIFY_LIMIT = 20;

/**
 * Read-only Paystack verification eligibility for non-claim pending payments.
 * Separate from the 24-hour abandonment policy in payment lifecycle.
 */
export const PAYSTACK_RECONCILIATION_PENDING_VERIFY_MINUTES = 60;
export const PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS =
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MINUTES * 60 * 1000;

export interface UnsettledPaystackPaymentFinding {
  reference: string;
  portalStatus: PaymentStatus;
  paystackStatus: PaymentStatus;
  expectedAmount: number;
  currency: string;
  missingContributions: string;
  /** Display-only fields; recovery always re-validates on the server. */
  memberId: string;
  memberName: string;
  serviceNumber: string | null;
  paymentType: string;
  periodLabel: string;
}

/**
 * Confirmed Paystack success whose monthly-dues period is already PAID on a
 * different payment reference. Read-only review signal — not a missing contribution.
 */
export interface PaystackSurplusDuplicateFinding {
  reference: string;
  memberId: string;
  serviceNumber: string | null;
  portalStatus: PaymentStatus;
  paystackStatus: PaymentStatus;
  expectedAmount: number;
  currency: string;
  periodLabel: string;
  existingPaymentReference: string;
}

export type PaystackVerificationLimitationReason =
  | "unavailable"
  | "timeout"
  | "rate_limit"
  | "error"
  | "not_checked";

export interface PaystackVerificationLimitation {
  reference: string | null;
  portalStatus: PaymentStatus | null;
  reason: PaystackVerificationLimitationReason;
  message: string;
}

export interface PaystackSettlementMismatch {
  reference: string;
  portalStatus: PaymentStatus;
  paystackStatus: PaymentStatus;
  expectedAmount: number;
  currency: string;
  issue: "amount" | "currency" | "reference";
}

export interface PaystackCandidateWindow {
  batch: number;
  batchSize: number;
  batchCount: number;
  candidateCount: number;
  rangeStart: number;
  rangeEnd: number;
  hasPrevious: boolean;
  hasNext: boolean;
  uncheckedCount: number;
  /** True when the requested batch was missing, malformed, or past the current list. */
  requestedBatchAdjusted: boolean;
}

/** Same batch size / pending age policy as Paystack reconciliation. */
export const HUBTEL_RECONCILIATION_VERIFY_LIMIT =
  PAYSTACK_RECONCILIATION_VERIFY_LIMIT;
export const HUBTEL_RECONCILIATION_PENDING_VERIFY_MS =
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS;

export interface UnsettledHubtelPaymentFinding {
  reference: string;
  portalStatus: PaymentStatus;
  hubtelStatus: PaymentStatus;
  /** Official welfare contribution amount (ledger). */
  expectedAmount: number;
  /** Gross Hubtel checkout amount used for provider verification. */
  expectedCheckoutAmount: number;
  currency: string;
  missingContributions: string;
  memberId: string;
  memberName: string;
  serviceNumber: string | null;
  paymentType: string;
  periodLabel: string;
}

export interface HubtelSurplusDuplicateFinding {
  reference: string;
  memberId: string;
  serviceNumber: string | null;
  portalStatus: PaymentStatus;
  hubtelStatus: PaymentStatus;
  expectedAmount: number;
  expectedCheckoutAmount: number;
  currency: string;
  periodLabel: string;
  existingPaymentReference: string;
}

export type HubtelVerificationLimitationReason =
  | PaystackVerificationLimitationReason
  | "no_record";

export interface HubtelVerificationLimitation {
  reference: string | null;
  portalStatus: PaymentStatus | null;
  reason: HubtelVerificationLimitationReason;
  message: string;
}

export interface HubtelSettlementMismatch {
  reference: string;
  portalStatus: PaymentStatus;
  hubtelStatus: PaymentStatus;
  expectedAmount: number;
  expectedCheckoutAmount: number;
  currency: string;
  issue: "amount" | "currency" | "reference";
}

export type HubtelCandidateWindow = PaystackCandidateWindow;

export interface ReconciliationSummary {
  paymentsMissingContributions: {
    count: number;
    records: SerializedPayment[];
  };
  contributionsMissingReceipts: {
    count: number;
    records: SerializedContribution[];
  };
  receiptsMissingPayments: {
    count: number;
    records: SerializedReceipt[];
  };
  unsettledPaystackPayments: {
    count: number;
    records: UnsettledPaystackPaymentFinding[];
  };
  paystackSurplusDuplicatePayments: {
    count: number;
    records: PaystackSurplusDuplicateFinding[];
  };
  paystackSettlementMismatches: {
    count: number;
    records: PaystackSettlementMismatch[];
  };
  paystackVerificationLimitations: {
    count: number;
    records: PaystackVerificationLimitation[];
  };
  paystackCandidateWindow: PaystackCandidateWindow;
  unsettledHubtelPayments: {
    count: number;
    records: UnsettledHubtelPaymentFinding[];
  };
  hubtelSurplusDuplicatePayments: {
    count: number;
    records: HubtelSurplusDuplicateFinding[];
  };
  hubtelSettlementMismatches: {
    count: number;
    records: HubtelSettlementMismatch[];
  };
  hubtelVerificationLimitations: {
    count: number;
    records: HubtelVerificationLimitation[];
  };
  hubtelCandidateWindow: HubtelCandidateWindow;
  isBalanced: boolean;
}

/**
 * 1-based batch selector for the read-only Paystack candidate window.
 * Invalid, zero, and negative values fall back to batch 1.
 * A batch past the current list is clamped to the last batch.
 */
export function resolvePaystackVerificationBatch(
  raw: unknown,
  candidateCount: number,
): { batch: number; batchCount: number; adjusted: boolean } {
  const batchCount = Math.max(
    1,
    Math.ceil(candidateCount / PAYSTACK_RECONCILIATION_VERIFY_LIMIT),
  );
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (text == null || (typeof text === "string" && text.trim() === "")) {
    return { batch: 1, batchCount, adjusted: false };
  }

  const parsed =
    typeof text === "number"
      ? text
      : typeof text === "string"
        ? Number(text.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    return { batch: 1, batchCount, adjusted: true };
  }
  if (parsed > batchCount) {
    return { batch: batchCount, batchCount, adjusted: true };
  }
  return { batch: parsed, batchCount, adjusted: false };
}

/** Build reconciliation URL preserving both provider batch query params when > 1. */
export function reconciliationBatchPath(options: {
  paystackBatch?: number;
  hubtelBatch?: number;
}): string {
  const params = new URLSearchParams();
  if (
    options.paystackBatch != null &&
    Number.isInteger(options.paystackBatch) &&
    options.paystackBatch > 1
  ) {
    params.set("paystackBatch", String(options.paystackBatch));
  }
  if (
    options.hubtelBatch != null &&
    Number.isInteger(options.hubtelBatch) &&
    options.hubtelBatch > 1
  ) {
    params.set("hubtelBatch", String(options.hubtelBatch));
  }
  const query = params.toString();
  return query
    ? `/admin/finance/reconciliation?${query}`
    : "/admin/finance/reconciliation";
}

export function paystackBatchPath(batch: number, hubtelBatch?: number): string {
  return reconciliationBatchPath({ paystackBatch: batch, hubtelBatch });
}

export function hubtelBatchPath(batch: number, paystackBatch?: number): string {
  return reconciliationBatchPath({ hubtelBatch: batch, paystackBatch });
}

/** Shared 1-based batch selector for Paystack and Hubtel candidate windows. */
export const resolveOnlineVerificationBatch = resolvePaystackVerificationBatch;

export function reconciliationStatusMessage(
  summary: Pick<
    ReconciliationSummary,
    | "isBalanced"
    | "unsettledPaystackPayments"
    | "paystackSurplusDuplicatePayments"
    | "paystackSettlementMismatches"
    | "paystackVerificationLimitations"
    | "unsettledHubtelPayments"
    | "hubtelSurplusDuplicatePayments"
    | "hubtelSettlementMismatches"
    | "hubtelVerificationLimitations"
  >,
): string {
  if (
    !summary.isBalanced ||
    summary.unsettledPaystackPayments.count > 0 ||
    summary.paystackSurplusDuplicatePayments.count > 0 ||
    summary.paystackSettlementMismatches.count > 0 ||
    summary.unsettledHubtelPayments.count > 0 ||
    summary.hubtelSurplusDuplicatePayments.count > 0 ||
    summary.hubtelSettlementMismatches.count > 0
  ) {
    return "One or more financial records need review.";
  }
  if (
    summary.paystackVerificationLimitations.count > 0 ||
    summary.hubtelVerificationLimitations.count > 0
  ) {
    return "Successful payments, contributions, and receipts are aligned. Some provider checks could not be verified.";
  }
  return "All successful payments, contributions, and receipts are aligned.";
}
