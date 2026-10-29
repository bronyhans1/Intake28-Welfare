import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import {
  findPaidMonthlyDuesContribution,
  listContributionsByPaymentReference,
} from "@/lib/contributions/repository";
import { canRecoverUnsettledPayments } from "@/lib/finance/reconciliation-permissions";
import { formatMonthYearLabel } from "@/lib/finance/period";
import { expectedContributionPeriodsForPayment } from "@/lib/payments/contribution-automation";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { getPaymentByReference } from "@/lib/payments/repository";
import {
  PaymentSettlementError,
  settlePaymentByReference,
} from "@/lib/payments/settlement";
import { getReceiptByPaymentReference } from "@/lib/receipts/repository";
import { PaymentStatus, PaymentType } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { SerializedPayment } from "@/types/payment";

export type UnsettledPaymentRecoveryOutcome =
  | "recovered"
  | "already_settled"
  | "ineligible_surplus"
  | "ineligible"
  | "verification_failed"
  | "unauthorized"
  | "manual_review";

export interface UnsettledPaymentRecoveryResult {
  outcome: UnsettledPaymentRecoveryOutcome;
  reference: string;
  message: string;
  paymentStatus?: PaymentStatus | null;
}

async function logRecoveryAudit(
  actor: CurrentUser,
  reference: string,
  outcome: UnsettledPaymentRecoveryOutcome,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_RECOVERY,
    entityType: "payment",
    entityId: reference,
    ...buildAuditActor(actor),
    metadata: {
      paymentReference: reference,
      outcome,
      recoverySource: "reconciliation",
      ...metadata,
    },
  });
}

/**
 * Pre-settle surplus guard: every expected monthly-dues period already PAID
 * for this member on a different payment reference.
 */
export async function assessMonthlyDuesRecoveryConflict(
  payment: Pick<
    SerializedPayment,
    "reference" | "memberId" | "paymentType" | "selectedMonths"
  >,
): Promise<
  | { kind: "none" }
  | { kind: "surplus"; existingPaymentReference: string; periodLabel: string }
  | { kind: "partial"; message: string }
> {
  if (payment.paymentType !== PaymentType.MONTHLY_DUES) {
    return { kind: "none" };
  }

  const periods = expectedContributionPeriodsForPayment(payment);
  if (periods.length === 0) {
    return { kind: "none" };
  }

  let unpaid = 0;
  let paidElsewhere = 0;
  let paidSameReference = 0;
  const elsewhereRefs: string[] = [];
  const elsewhereLabels: string[] = [];

  for (const period of periods) {
    const existing = await findPaidMonthlyDuesContribution(
      payment.memberId,
      period.month,
      period.year,
    );
    if (!existing) {
      unpaid += 1;
      continue;
    }
    if (existing.paymentReference === payment.reference) {
      paidSameReference += 1;
      continue;
    }
    paidElsewhere += 1;
    if (existing.paymentReference) {
      elsewhereRefs.push(existing.paymentReference);
    }
    elsewhereLabels.push(formatMonthYearLabel(period));
  }

  if (paidElsewhere > 0 && unpaid > 0) {
    return {
      kind: "partial",
      message:
        "Some contribution periods are already paid on another reference while others are unpaid. Manual review is required.",
    };
  }

  if (paidElsewhere > 0 && unpaid === 0) {
    return {
      kind: "surplus",
      existingPaymentReference: [...new Set(elsewhereRefs)].join(", "),
      periodLabel: elsewhereLabels.join(", "),
    };
  }

  if (unpaid === 0 && paidSameReference === periods.length) {
    return { kind: "none" };
  }

  return { kind: "none" };
}

/**
 * Authorized, server-side recovery of an unsettled online payment via the
 * shared provider-aware settlement path. Never trusts browser-supplied
 * eligibility fields. Routes Hubtel and Paystack by the stored payment provider.
 */
export async function recoverUnsettledPayment(
  reference: string,
  actor: CurrentUser,
): Promise<UnsettledPaymentRecoveryResult> {
  const trimmed = reference.trim();
  if (!trimmed) {
    return {
      outcome: "ineligible",
      reference: "",
      message: "Payment reference is required.",
    };
  }

  if (!canRecoverUnsettledPayments(actor.role)) {
    await logRecoveryAudit(actor, trimmed, "unauthorized");
    return {
      outcome: "unauthorized",
      reference: trimmed,
      message: "You do not have permission to recover unsettled payments.",
    };
  }

  const payment = await getPaymentByReference(trimmed);
  if (!payment) {
    await logRecoveryAudit(actor, trimmed, "ineligible", {
      reason: "payment_not_found",
    });
    return {
      outcome: "ineligible",
      reference: trimmed,
      message: "Payment not found.",
    };
  }

  if (payment.paymentType === PaymentType.CLAIM_PAYMENT) {
    await logRecoveryAudit(actor, trimmed, "ineligible", {
      reason: "claim_payment",
      portalStatus: payment.status,
    });
    return {
      outcome: "ineligible",
      reference: trimmed,
      message: "Claim payments cannot be recovered from reconciliation.",
      paymentStatus: payment.status,
    };
  }

  const conflict = await assessMonthlyDuesRecoveryConflict(payment);
  if (conflict.kind === "surplus") {
    await logRecoveryAudit(actor, trimmed, "ineligible_surplus", {
      portalStatus: payment.status,
      existingPaymentReference: conflict.existingPaymentReference,
      periodLabel: conflict.periodLabel,
    });
    return {
      outcome: "ineligible_surplus",
      reference: trimmed,
      message: `This period (${conflict.periodLabel}) is already paid on ${conflict.existingPaymentReference}. Recovery will not create another contribution.`,
      paymentStatus: payment.status,
    };
  }
  if (conflict.kind === "partial") {
    await logRecoveryAudit(actor, trimmed, "manual_review", {
      portalStatus: payment.status,
      reason: "partial_period_conflict",
    });
    return {
      outcome: "manual_review",
      reference: trimmed,
      message: conflict.message,
      paymentStatus: payment.status,
    };
  }

  if (payment.status === PaymentStatus.SUCCESS) {
    try {
      const settled = await settlePaymentByReference(trimmed, {
        actor,
        source: "recovery",
      });
      const contributions = await listContributionsByPaymentReference(trimmed);
      const receipt = await getReceiptByPaymentReference(trimmed);
      await logRecoveryAudit(actor, trimmed, "already_settled", {
        portalStatus: settled.payment.status,
        contributionCount: contributions.length,
        hasReceipt: Boolean(receipt),
        settlementOutcome: settled.outcome,
      });
      return {
        outcome: "already_settled",
        reference: trimmed,
        message:
          "Payment was already settled. Contribution and receipt records were re-checked.",
        paymentStatus: settled.payment.status,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recovery heal failed.";
      await logRecoveryAudit(actor, trimmed, "manual_review", {
        portalStatus: payment.status,
        reason: "already_settled_heal_failed",
        error: message,
      });
      return {
        outcome: "manual_review",
        reference: trimmed,
        message,
        paymentStatus: payment.status,
      };
    }
  }

  try {
    const settled = await settlePaymentByReference(trimmed, {
      actor,
      source: "recovery",
    });

    if (settled.outcome === "failed" || settled.outcome === "pending") {
      await logRecoveryAudit(actor, trimmed, "verification_failed", {
        portalStatus: settled.payment.status,
        settlementOutcome: settled.outcome,
      });
      return {
        outcome: "verification_failed",
        reference: trimmed,
        message:
          settled.message ??
          "The payment provider did not confirm a successful charge. Recovery was not applied.",
        paymentStatus: settled.payment.status,
      };
    }

    const postConflict = await assessMonthlyDuesRecoveryConflict(settled.payment);
    if (postConflict.kind === "surplus") {
      await logRecoveryAudit(actor, trimmed, "ineligible_surplus", {
        portalStatus: settled.payment.status,
        existingPaymentReference: postConflict.existingPaymentReference,
        settlementOutcome: settled.outcome,
        note: "Settlement completed but contribution period is paid elsewhere.",
      });
      return {
        outcome: "ineligible_surplus",
        reference: trimmed,
        message: `Payment status was updated, but ${postConflict.periodLabel} is already paid on ${postConflict.existingPaymentReference}. No duplicate contribution was created.`,
        paymentStatus: settled.payment.status,
      };
    }

    if (settled.outcome === "already_settled") {
      await logRecoveryAudit(actor, trimmed, "already_settled", {
        portalStatus: settled.payment.status,
        settlementOutcome: settled.outcome,
      });
      return {
        outcome: "already_settled",
        reference: trimmed,
        message: "Payment was already settled.",
        paymentStatus: settled.payment.status,
      };
    }

    await logRecoveryAudit(actor, trimmed, "recovered", {
      portalStatus: settled.payment.status,
      amount: settled.payment.amount,
      currency: settled.payment.currency,
      paymentType: settled.payment.paymentType,
      settlementOutcome: settled.outcome,
    });

    return {
      outcome: "recovered",
      reference: trimmed,
      message: "Payment recovered. Contribution and receipt recording was applied.",
      paymentStatus: settled.payment.status,
    };
  } catch (error) {
    if (error instanceof PaymentSettlementError) {
      const latest = await getPaymentByReference(trimmed);
      if (latest?.status === PaymentStatus.SUCCESS) {
        await logRecoveryAudit(actor, trimmed, "manual_review", {
          portalStatus: latest.status,
          reason: "settlement_error_after_success",
          error: error.message,
        });
        return {
          outcome: "manual_review",
          reference: trimmed,
          message: `Payment may already be marked successful, but recovery reported: ${error.message}`,
          paymentStatus: latest.status,
        };
      }
      await logRecoveryAudit(actor, trimmed, "verification_failed", {
        portalStatus: latest?.status ?? payment.status,
        error: error.message,
      });
      return {
        outcome: "verification_failed",
        reference: trimmed,
        message: error.message,
        paymentStatus: latest?.status ?? payment.status,
      };
    }

    const latest = await getPaymentByReference(trimmed);
    const message =
      error instanceof Error ? error.message : "Recovery failed unexpectedly.";
    if (latest?.status === PaymentStatus.SUCCESS) {
      await logRecoveryAudit(actor, trimmed, "manual_review", {
        portalStatus: latest.status,
        reason: "post_success_recording_error",
        error: message,
      });
      return {
        outcome: "manual_review",
        reference: trimmed,
        message: `Payment is successful in the portal, but a recording step failed: ${message}`,
        paymentStatus: latest.status,
      };
    }

    await logRecoveryAudit(actor, trimmed, "manual_review", {
      portalStatus: latest?.status ?? payment.status,
      error: message,
    });
    return {
      outcome: "manual_review",
      reference: trimmed,
      message,
      paymentStatus: latest?.status ?? payment.status,
    };
  }
}

/** @deprecated Prefer recoverUnsettledPayment — same provider-aware recovery path. */
export const recoverUnsettledPaystackPayment = recoverUnsettledPayment;
