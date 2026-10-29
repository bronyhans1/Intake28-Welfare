import { env } from "@/config/env";
import { fetchAllContributionsForReport } from "@/lib/reports/data";
import { getReceiptByPaymentReference, listReceipts } from "@/lib/receipts/repository";
import { loadPaymentsByReference } from "@/lib/payments/repository";
import { expectedContributionPeriodsForPayment } from "@/lib/payments/contribution-automation";
import { assessPaystackSettlementMatch } from "@/lib/payments/paystack-settlement-rules";
import { assessHubtelSettlementMatch } from "@/lib/payments/hubtel-settlement-rules";
import { resolveExpectedCheckoutAmount } from "@/lib/payments/checkout-amount";
import {
  paystackVerifyTransaction,
  PaystackConfigurationError,
  PaystackRequestError,
} from "@/lib/integrations/paystack/client";
import {
  hubtelFetchTransactionStatus,
  HubtelStatusRequestError,
  isHubtelNoRecordStatusError,
} from "@/lib/integrations/hubtel/status";
import {
  HubtelPaymentConfigurationError,
  isHubtelPaymentConfigured,
} from "@/lib/integrations/hubtel/checkout-config";
import {
  clearHubtelNoRecordLookup,
  isHubtelNoRecordSuppressed,
  persistHubtelNoRecordFromStatusError,
} from "@/lib/payments/hubtel-no-record";
import {
  ContributionStatus,
  ContributionType,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from "@/types/enums";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedPayment } from "@/types/payment";
import { formatMonthYearLabel, monthYearKey } from "@/lib/finance/period";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import {
  HUBTEL_RECONCILIATION_VERIFY_LIMIT,
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS,
  PAYSTACK_RECONCILIATION_VERIFY_LIMIT,
  resolveOnlineVerificationBatch,
  resolvePaystackVerificationBatch,
  type HubtelCandidateWindow,
  type HubtelSettlementMismatch,
  type HubtelSurplusDuplicateFinding,
  type HubtelVerificationLimitation,
  type HubtelVerificationLimitationReason,
  type PaystackCandidateWindow,
  type PaystackSettlementMismatch,
  type PaystackSurplusDuplicateFinding,
  type PaystackVerificationLimitation,
  type PaystackVerificationLimitationReason,
  type ReconciliationSummary,
  type UnsettledHubtelPaymentFinding,
  type UnsettledPaystackPaymentFinding,
} from "@/lib/finance/reconciliation-view";

export {
  HUBTEL_RECONCILIATION_VERIFY_LIMIT,
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MINUTES,
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS,
  PAYSTACK_RECONCILIATION_VERIFY_LIMIT,
  hubtelBatchPath,
  paystackBatchPath,
  reconciliationStatusMessage,
  resolveOnlineVerificationBatch,
  resolvePaystackVerificationBatch,
} from "@/lib/finance/reconciliation-view";
export type {
  HubtelCandidateWindow,
  HubtelSettlementMismatch,
  HubtelSurplusDuplicateFinding,
  HubtelVerificationLimitation,
  HubtelVerificationLimitationReason,
  PaystackCandidateWindow,
  PaystackSettlementMismatch,
  PaystackSurplusDuplicateFinding,
  PaystackVerificationLimitation,
  PaystackVerificationLimitationReason,
  ReconciliationSummary,
  UnsettledHubtelPaymentFinding,
  UnsettledPaystackPaymentFinding,
} from "@/lib/finance/reconciliation-view";

const PAYSTACK_RECONCILIATION_TIMEOUT_MS = 8_000;
const HUBTEL_RECONCILIATION_TIMEOUT_MS = 8_000;

function emptyPaystackWindow(): PaystackCandidateWindow {
  return {
    batch: 1,
    batchSize: PAYSTACK_RECONCILIATION_VERIFY_LIMIT,
    batchCount: 1,
    candidateCount: 0,
    rangeStart: 0,
    rangeEnd: 0,
    hasPrevious: false,
    hasNext: false,
    uncheckedCount: 0,
    requestedBatchAdjusted: false,
  };
}

function emptyHubtelWindow(): HubtelCandidateWindow {
  return {
    batch: 1,
    batchSize: HUBTEL_RECONCILIATION_VERIFY_LIMIT,
    batchCount: 1,
    candidateCount: 0,
    rangeStart: 0,
    rangeEnd: 0,
    hasPrevious: false,
    hasNext: false,
    uncheckedCount: 0,
    requestedBatchAdjusted: false,
  };
}

function serializePaymentDoc(
  id: string,
  data: Record<string, unknown>,
): SerializedPayment {
  return serializeFirestoreDoc<SerializedPayment>(
    id,
    data,
  ) as unknown as SerializedPayment;
}

async function fetchPaymentsByStatus(
  status: PaymentStatus,
): Promise<SerializedPayment[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("status", "==", status)
    .get();

  return snapshot.docs.map((doc) =>
    serializePaymentDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

async function fetchAllSuccessPayments(): Promise<SerializedPayment[]> {
  return fetchPaymentsByStatus(PaymentStatus.SUCCESS);
}

function isPendingEligibleForPaystackVerify(
  payment: SerializedPayment,
  now: Date,
): boolean {
  if (payment.status !== PaymentStatus.PENDING || !payment.createdAt) {
    return false;
  }
  const createdAt = Date.parse(payment.createdAt);
  if (Number.isNaN(createdAt)) {
    return false;
  }
  return now.getTime() - createdAt >= PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS;
}

function isPaystackCandidate(payment: SerializedPayment, now: Date): boolean {
  if (payment.provider !== PaymentProvider.PAYSTACK) return false;
  if (payment.paymentType === PaymentType.CLAIM_PAYMENT) return false;
  if (payment.status === PaymentStatus.SUCCESS) return false;
  if (payment.status === PaymentStatus.ABANDONED) return true;
  return isPendingEligibleForPaystackVerify(payment, now);
}

function isHubtelCandidate(payment: SerializedPayment, now: Date): boolean {
  if (payment.provider !== PaymentProvider.HUBTEL) return false;
  if (payment.paymentType === PaymentType.CLAIM_PAYMENT) return false;
  if (payment.status === PaymentStatus.SUCCESS) return false;
  if (payment.status === PaymentStatus.ABANDONED) return true;
  return isPendingEligibleForPaystackVerify(payment, now);
}

/**
 * When every expected monthly-dues period is already PAID for the same member on
 * a different payment reference, treat as surplus/duplicate — not a missing contribution.
 */
function findSurplusDuplicateCoverage(
  payment: SerializedPayment,
  contributions: SerializedContribution[],
): { periodLabel: string; existingPaymentReference: string } | null {
  if (payment.paymentType !== PaymentType.MONTHLY_DUES) {
    return null;
  }

  const periods = expectedContributionPeriodsForPayment(payment);
  if (periods.length === 0) {
    return null;
  }

  const labels: string[] = [];
  const existingRefs: string[] = [];

  for (const period of periods) {
    const paidElsewhere = contributions.find(
      (contribution) =>
        contribution.memberId === payment.memberId &&
        contribution.contributionType === ContributionType.MONTHLY_DUES &&
        contribution.status === ContributionStatus.PAID &&
        contribution.month === period.month &&
        contribution.year === period.year &&
        typeof contribution.paymentReference === "string" &&
        contribution.paymentReference.length > 0 &&
        contribution.paymentReference !== payment.reference,
    );
    if (!paidElsewhere?.paymentReference) {
      return null;
    }
    labels.push(formatMonthYearLabel(period));
    existingRefs.push(paidElsewhere.paymentReference);
  }

  return {
    periodLabel: labels.join(", "),
    existingPaymentReference: [...new Set(existingRefs)].join(", "),
  };
}

function describeMissingContributions(
  payment: SerializedPayment,
  contributions: SerializedContribution[],
): string | null {
  if (payment.paymentType === PaymentType.CLAIM_PAYMENT) {
    return null;
  }

  if (payment.paymentType === PaymentType.MONTHLY_DUES) {
    const periods = expectedContributionPeriodsForPayment(payment);
    const recorded = new Set(
      contributions
        .filter(
          (contribution) =>
            contribution.paymentReference === payment.reference &&
            contribution.contributionType === ContributionType.MONTHLY_DUES &&
            contribution.status === ContributionStatus.PAID &&
            typeof contribution.month === "number" &&
            typeof contribution.year === "number",
        )
        .map((contribution) =>
          monthYearKey({ month: contribution.month, year: contribution.year }),
        ),
    );
    const missing = periods.filter((period) => !recorded.has(monthYearKey(period)));
    if (missing.length === 0) return null;
    const labels = missing.map((period) => formatMonthYearLabel(period)).join(", ");
    if (missing.length === periods.length) {
      return `No monthly-dues contribution recorded for ${labels}.`;
    }
    return `Missing monthly-dues contribution for ${labels}.`;
  }

  const recorded = contributions.some(
    (contribution) =>
      contribution.paymentReference === payment.reference &&
      contribution.status === ContributionStatus.PAID,
  );
  if (!recorded) {
    return "No contribution recorded for this payment.";
  }
  return null;
}

function limitationMessage(reason: PaystackVerificationLimitationReason): string {
  switch (reason) {
    case "unavailable":
      return "Paystack verification is unavailable. This payment was not compared with Paystack.";
    case "timeout":
      return "Paystack verification timed out. This payment was not confirmed.";
    case "rate_limit":
      return "Paystack rate limit reached. This payment was not confirmed.";
    case "not_checked":
      return "Paystack verification stopped before this payment was checked.";
    default:
      return "Paystack verification could not be completed. This payment was not confirmed.";
  }
}

function classifyVerificationError(
  error: unknown,
): PaystackVerificationLimitationReason {
  if (error instanceof PaystackConfigurationError) return "unavailable";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timed out") || message.includes("timeout")) return "timeout";
  if (
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("429")
  ) {
    return "rate_limit";
  }
  return "error";
}

async function verifyPaystackReadOnly(reference: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      paystackVerifyTransaction(reference),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new PaystackRequestError("Paystack verification timed out."));
        }, PAYSTACK_RECONCILIATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function awaitBoth<Left, Right>(
  left: Promise<Left>,
  right: Promise<Right>,
): Promise<[Left, Right]> {
  const [leftResult, rightResult] = await Promise.allSettled([left, right]);
  if (leftResult.status === "rejected") {
    throw leftResult.reason;
  }
  if (rightResult.status === "rejected") {
    throw rightResult.reason;
  }
  return [leftResult.value, rightResult.value];
}

async function findUnsettledPaystackPayments(
  contributionsPromise: Promise<SerializedContribution[]>,
  now: Date,
  paystackBatch: unknown,
): Promise<
  Pick<
    ReconciliationSummary,
    | "unsettledPaystackPayments"
    | "paystackSurplusDuplicatePayments"
    | "paystackSettlementMismatches"
    | "paystackVerificationLimitations"
    | "paystackCandidateWindow"
  >
> {
  const unsettled: UnsettledPaystackPaymentFinding[] = [];
  const surplusDuplicates: PaystackSurplusDuplicateFinding[] = [];
  const mismatches: PaystackSettlementMismatch[] = [];
  const limitations: PaystackVerificationLimitation[] = [];
  let window = emptyPaystackWindow();

  const result = () => ({
    unsettledPaystackPayments: { count: unsettled.length, records: unsettled },
    paystackSurplusDuplicatePayments: {
      count: surplusDuplicates.length,
      records: surplusDuplicates,
    },
    paystackSettlementMismatches: { count: mismatches.length, records: mismatches },
    paystackVerificationLimitations: {
      count: limitations.length,
      records: limitations,
    },
    paystackCandidateWindow: window,
  });

  if (!env.server().PAYSTACK_SECRET_KEY) {
    limitations.push({
      reference: null,
      portalStatus: null,
      reason: "unavailable",
      message:
        "Paystack verification is unavailable. Unsettled payments were not compared with Paystack.",
    });
    return result();
  }

  const [abandoned, pending] = await Promise.all([
    fetchPaymentsByStatus(PaymentStatus.ABANDONED),
    fetchPaymentsByStatus(PaymentStatus.PENDING),
  ]);

  const candidates = [...abandoned, ...pending]
    .filter((payment) => isPaystackCandidate(payment, now))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  const resolved = resolvePaystackVerificationBatch(paystackBatch, candidates.length);
  const start = (resolved.batch - 1) * PAYSTACK_RECONCILIATION_VERIFY_LIMIT;
  const selected = candidates.slice(start, start + PAYSTACK_RECONCILIATION_VERIFY_LIMIT);
  const uncheckedCount = candidates.length - selected.length;
  window = {
    batch: resolved.batch,
    batchSize: PAYSTACK_RECONCILIATION_VERIFY_LIMIT,
    batchCount: resolved.batchCount,
    candidateCount: candidates.length,
    rangeStart: selected.length === 0 ? 0 : start + 1,
    rangeEnd: start + selected.length,
    hasPrevious: resolved.batch > 1,
    hasNext: resolved.batch < resolved.batchCount,
    uncheckedCount,
    requestedBatchAdjusted: resolved.adjusted,
  };

  if (uncheckedCount > 0) {
    limitations.push({
      reference: null,
      portalStatus: null,
      reason: "not_checked",
      message: `Batch ${resolved.batch} of ${resolved.batchCount} checked eligible payments ${window.rangeStart}–${window.rangeEnd} of ${candidates.length}, oldest first. ${uncheckedCount} eligible payments are outside this batch and were not sent to Paystack. Open another batch to check them. Reloading this page repeats this same batch. New or settled payments can shift which references fall in each batch.`,
    });
  }

  let stopReason: PaystackVerificationLimitationReason | null = null;
  const verified: Array<{
    payment: SerializedPayment;
    verification: Awaited<ReturnType<typeof verifyPaystackReadOnly>>;
  }> = [];

  for (const payment of selected) {
    if (stopReason) {
      limitations.push({
        reference: payment.reference,
        portalStatus: payment.status,
        reason: stopReason,
        message: limitationMessage(stopReason),
      });
      continue;
    }

    try {
      const verification = await verifyPaystackReadOnly(payment.reference);
      verified.push({ payment, verification });
    } catch (error) {
      const reason = classifyVerificationError(error);
      limitations.push({
        reference: payment.reference,
        portalStatus: payment.status,
        reason,
        message: limitationMessage(reason),
      });
      if (reason === "unavailable" || reason === "rate_limit") {
        stopReason = reason;
      }
    }
  }

  const contributions = await contributionsPromise;

  for (const { payment, verification } of verified) {
    const match = assessPaystackSettlementMatch(payment, verification);
    if (!match.consistent) {
      if (match.issue !== "status") {
        mismatches.push({
          reference: payment.reference,
          portalStatus: payment.status,
          paystackStatus: verification.status,
          expectedAmount: payment.amount,
          currency: payment.currency,
          issue: match.issue,
        });
      }
      continue;
    }

    const missingContributions = describeMissingContributions(payment, contributions);
    if (!missingContributions) continue;

    const surplus = findSurplusDuplicateCoverage(payment, contributions);
    if (surplus) {
      surplusDuplicates.push({
        reference: payment.reference,
        memberId: payment.memberId,
        serviceNumber: payment.serviceNumber ?? null,
        portalStatus: payment.status,
        paystackStatus: verification.status,
        expectedAmount: payment.amount,
        currency: payment.currency,
        periodLabel: surplus.periodLabel,
        existingPaymentReference: surplus.existingPaymentReference,
      });
      continue;
    }

    const periods = expectedContributionPeriodsForPayment(payment);
    unsettled.push({
      reference: payment.reference,
      portalStatus: payment.status,
      paystackStatus: verification.status,
      expectedAmount: payment.amount,
      currency: payment.currency,
      missingContributions,
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber ?? null,
      paymentType: payment.paymentType,
      periodLabel:
        periods.length > 0
          ? periods.map((period) => formatMonthYearLabel(period)).join(", ")
          : missingContributions,
    });
  }

  return result();
}

function hubtelLimitationMessage(reason: HubtelVerificationLimitationReason): string {
  switch (reason) {
    case "unavailable":
      return "Hubtel verification is unavailable. This payment was not compared with Hubtel.";
    case "timeout":
      return "Hubtel verification timed out. This payment was not confirmed.";
    case "rate_limit":
      return "Hubtel rate limit reached. This payment was not confirmed.";
    case "not_checked":
      return "Hubtel verification stopped before this payment was checked.";
    case "no_record":
      return "Hubtel has no matching transaction for this reference (or it is older than one month). This is not treated as a failed payment. Automatic status checks are paused temporarily; use Check status or force a Hubtel recheck to look up again.";
    default:
      return "Hubtel verification could not be completed. This payment was not confirmed.";
  }
}

function classifyHubtelVerificationError(
  error: unknown,
): HubtelVerificationLimitationReason {
  if (error instanceof HubtelPaymentConfigurationError) return "unavailable";
  if (isHubtelNoRecordStatusError(error)) return "no_record";
  if (error instanceof HubtelStatusRequestError && !error.retryable) {
    return "error";
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timed out") || message.includes("timeout")) return "timeout";
  if (
    message.includes("rate limit") ||
    message.includes("too many") ||
    message.includes("429")
  ) {
    return "rate_limit";
  }
  if (
    message.includes("not configured") ||
    message.includes("unable to reach")
  ) {
    return error instanceof HubtelStatusRequestError && error.retryable
      ? "timeout"
      : "unavailable";
  }
  return "error";
}

function resolveHubtelForceRecheck(raw: unknown): boolean {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (text == null) return false;
  if (typeof text === "boolean") return text;
  if (typeof text === "number") return text === 1;
  if (typeof text !== "string") return false;
  const normalized = text.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function verifyHubtelReadOnly(reference: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      hubtelFetchTransactionStatus(reference),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new HubtelStatusRequestError("Hubtel verification timed out.", {
            retryable: true,
          }));
        }, HUBTEL_RECONCILIATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function findUnsettledHubtelPayments(
  contributionsPromise: Promise<SerializedContribution[]>,
  now: Date,
  hubtelBatch: unknown,
  hubtelForceRecheck: boolean,
): Promise<
  Pick<
    ReconciliationSummary,
    | "unsettledHubtelPayments"
    | "hubtelSurplusDuplicatePayments"
    | "hubtelSettlementMismatches"
    | "hubtelVerificationLimitations"
    | "hubtelCandidateWindow"
  >
> {
  const unsettled: UnsettledHubtelPaymentFinding[] = [];
  const surplusDuplicates: HubtelSurplusDuplicateFinding[] = [];
  const mismatches: HubtelSettlementMismatch[] = [];
  const limitations: HubtelVerificationLimitation[] = [];
  let window = emptyHubtelWindow();

  const result = () => ({
    unsettledHubtelPayments: { count: unsettled.length, records: unsettled },
    hubtelSurplusDuplicatePayments: {
      count: surplusDuplicates.length,
      records: surplusDuplicates,
    },
    hubtelSettlementMismatches: { count: mismatches.length, records: mismatches },
    hubtelVerificationLimitations: {
      count: limitations.length,
      records: limitations,
    },
    hubtelCandidateWindow: window,
  });

  if (!isHubtelPaymentConfigured()) {
    limitations.push({
      reference: null,
      portalStatus: null,
      reason: "unavailable",
      message:
        "Hubtel verification is unavailable. Unsettled Hubtel payments were not compared with Hubtel.",
    });
    return result();
  }

  const [abandoned, pending] = await Promise.all([
    fetchPaymentsByStatus(PaymentStatus.ABANDONED),
    fetchPaymentsByStatus(PaymentStatus.PENDING),
  ]);

  const candidates = [...abandoned, ...pending]
    .filter((payment) => isHubtelCandidate(payment, now))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  const resolved = resolveOnlineVerificationBatch(hubtelBatch, candidates.length);
  const start = (resolved.batch - 1) * HUBTEL_RECONCILIATION_VERIFY_LIMIT;
  const selected = candidates.slice(start, start + HUBTEL_RECONCILIATION_VERIFY_LIMIT);
  const uncheckedCount = candidates.length - selected.length;
  window = {
    batch: resolved.batch,
    batchSize: HUBTEL_RECONCILIATION_VERIFY_LIMIT,
    batchCount: resolved.batchCount,
    candidateCount: candidates.length,
    rangeStart: selected.length === 0 ? 0 : start + 1,
    rangeEnd: start + selected.length,
    hasPrevious: resolved.batch > 1,
    hasNext: resolved.batch < resolved.batchCount,
    uncheckedCount,
    requestedBatchAdjusted: resolved.adjusted,
  };

  if (uncheckedCount > 0) {
    limitations.push({
      reference: null,
      portalStatus: null,
      reason: "not_checked",
      message: `Batch ${resolved.batch} of ${resolved.batchCount} checked eligible Hubtel payments ${window.rangeStart}–${window.rangeEnd} of ${candidates.length}, oldest first. ${uncheckedCount} eligible Hubtel payments are outside this batch and were not sent to Hubtel. Open another Hubtel batch to check them.`,
    });
  }

  let stopReason: HubtelVerificationLimitationReason | null = null;
  const verified: Array<{
    payment: SerializedPayment;
    verification: Awaited<ReturnType<typeof verifyHubtelReadOnly>>;
  }> = [];

  for (const payment of selected) {
    if (stopReason) {
      limitations.push({
        reference: payment.reference,
        portalStatus: payment.status,
        reason: stopReason,
        message: hubtelLimitationMessage(stopReason),
      });
      continue;
    }

    if (!hubtelForceRecheck && isHubtelNoRecordSuppressed(payment, now)) {
      limitations.push({
        reference: payment.reference,
        portalStatus: payment.status,
        reason: "no_record",
        message: hubtelLimitationMessage("no_record"),
      });
      continue;
    }

    try {
      const verification = await verifyHubtelReadOnly(payment.reference);
      if (
        payment.hubtelNoRecordCheckedAt != null ||
        payment.hubtelNoRecordResponseCode != null
      ) {
        await clearHubtelNoRecordLookup(payment.reference);
      }
      verified.push({ payment, verification });
    } catch (error) {
      const reason = classifyHubtelVerificationError(error);
      if (isHubtelNoRecordStatusError(error)) {
        await persistHubtelNoRecordFromStatusError(
          payment.reference,
          error,
          hubtelForceRecheck ? "reconciliation_recheck" : "reconciliation",
        );
      }
      limitations.push({
        reference: payment.reference,
        portalStatus: payment.status,
        reason,
        message: hubtelLimitationMessage(reason),
      });
      if (reason === "unavailable" || reason === "rate_limit") {
        stopReason = reason;
      }
    }
  }

  const contributions = await contributionsPromise;

  for (const { payment, verification } of verified) {
    const match = assessHubtelSettlementMatch(payment, verification);
    const expectedCheckoutAmount = resolveExpectedCheckoutAmount(payment);
    if (!match.consistent) {
      if (match.issue !== "status") {
        mismatches.push({
          reference: payment.reference,
          portalStatus: payment.status,
          hubtelStatus: verification.status,
          expectedAmount: payment.amount,
          expectedCheckoutAmount,
          currency: payment.currency,
          issue: match.issue,
        });
      }
      continue;
    }

    const missingContributions = describeMissingContributions(payment, contributions);
    if (!missingContributions) continue;

    const surplus = findSurplusDuplicateCoverage(payment, contributions);
    if (surplus) {
      surplusDuplicates.push({
        reference: payment.reference,
        memberId: payment.memberId,
        serviceNumber: payment.serviceNumber ?? null,
        portalStatus: payment.status,
        hubtelStatus: verification.status,
        expectedAmount: payment.amount,
        expectedCheckoutAmount,
        currency: payment.currency,
        periodLabel: surplus.periodLabel,
        existingPaymentReference: surplus.existingPaymentReference,
      });
      continue;
    }

    const periods = expectedContributionPeriodsForPayment(payment);
    unsettled.push({
      reference: payment.reference,
      portalStatus: payment.status,
      hubtelStatus: verification.status,
      expectedAmount: payment.amount,
      expectedCheckoutAmount,
      currency: payment.currency,
      missingContributions,
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber ?? null,
      paymentType: payment.paymentType,
      periodLabel:
        periods.length > 0
          ? periods.map((period) => formatMonthYearLabel(period)).join(", ")
          : missingContributions,
    });
  }

  return result();
}

async function assembleLocalFindings(
  successPaymentsPromise: Promise<SerializedPayment[]>,
  contributionsPromise: Promise<SerializedContribution[]>,
  receiptsPromise: ReturnType<typeof listReceipts>,
  paymentsByReferencePromise: ReturnType<typeof loadPaymentsByReference>,
) {
  const [successPayments, contributions, receiptsResult, paymentsByReference] =
    await Promise.all([
      successPaymentsPromise,
      contributionsPromise,
      receiptsPromise,
      paymentsByReferencePromise,
    ]);

  const receipts = receiptsResult.records;
  const contributionByReference = new Map(
    contributions
      .filter((item) => item.paymentReference)
      .map((item) => [item.paymentReference as string, item]),
  );
  const receiptByReference = new Map(
    receipts.map((item) => [item.paymentReference, item]),
  );

  const contributionPayments = successPayments.filter(
    (payment) => payment.paymentType !== PaymentType.CLAIM_PAYMENT,
  );

  const paymentsMissingContributions = contributionPayments.filter(
    (payment) => !contributionByReference.has(payment.reference),
  );

  const contributionsMissingReceipts = contributions.filter((contribution) => {
    if (!contribution.paymentReference) {
      return false;
    }
    return !receiptByReference.has(contribution.paymentReference);
  });

  const receiptsMissingPayments = receipts.filter((receipt) => {
    const payment = paymentsByReference.get(receipt.paymentReference) ?? null;
    return !payment || payment.status !== PaymentStatus.SUCCESS;
  });

  return {
    paymentsMissingContributions,
    contributionsMissingReceipts,
    receiptsMissingPayments,
  };
}

export async function getReconciliationSummary(options?: {
  paystackBatch?: unknown;
  hubtelBatch?: unknown;
  /** When true, bypass no-record suppression and call Hubtel again for this batch. */
  hubtelForceRecheck?: unknown;
}): Promise<ReconciliationSummary> {
  const contributionsPromise = fetchAllContributionsForReport({});
  const successPaymentsPromise = fetchAllSuccessPayments();
  const receiptsPromise = listReceipts({ page: 1, pageSize: 10_000 });
  const paymentsByReferencePromise = loadPaymentsByReference();
  const now = new Date();
  const hubtelForceRecheck = resolveHubtelForceRecheck(options?.hubtelForceRecheck);
  const providerPromise = Promise.all([
    findUnsettledPaystackPayments(
      contributionsPromise,
      now,
      options?.paystackBatch,
    ),
    findUnsettledHubtelPayments(
      contributionsPromise,
      now,
      options?.hubtelBatch,
      hubtelForceRecheck,
    ),
  ]).then(([paystackFindings, hubtelFindings]) => ({
    ...paystackFindings,
    ...hubtelFindings,
  }));

  const [localFindings, providerFindings] = await awaitBoth(
    assembleLocalFindings(
      successPaymentsPromise,
      contributionsPromise,
      receiptsPromise,
      paymentsByReferencePromise,
    ),
    providerPromise,
  );

  const summary: ReconciliationSummary = {
    paymentsMissingContributions: {
      count: localFindings.paymentsMissingContributions.length,
      records: localFindings.paymentsMissingContributions,
    },
    contributionsMissingReceipts: {
      count: localFindings.contributionsMissingReceipts.length,
      records: localFindings.contributionsMissingReceipts,
    },
    receiptsMissingPayments: {
      count: localFindings.receiptsMissingPayments.length,
      records: localFindings.receiptsMissingPayments,
    },
    ...providerFindings,
    isBalanced:
      localFindings.paymentsMissingContributions.length === 0 &&
      localFindings.contributionsMissingReceipts.length === 0 &&
      localFindings.receiptsMissingPayments.length === 0 &&
      providerFindings.unsettledPaystackPayments.count === 0 &&
      providerFindings.paystackSurplusDuplicatePayments.count === 0 &&
      providerFindings.paystackSettlementMismatches.count === 0 &&
      providerFindings.unsettledHubtelPayments.count === 0 &&
      providerFindings.hubtelSurplusDuplicatePayments.count === 0 &&
      providerFindings.hubtelSettlementMismatches.count === 0,
  };

  return summary;
}

export async function getReceiptByPaymentReferenceForReconciliation(
  paymentReference: string,
) {
  return getReceiptByPaymentReference(paymentReference);
}
