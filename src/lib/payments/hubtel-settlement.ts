import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import {
  hubtelFetchTransactionStatus,
  HubtelStatusRequestError,
  isHubtelNoRecordStatusError,
} from "@/lib/integrations/hubtel/status";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { ensureContributionFromPayment } from "@/lib/payments/contribution-automation";
import {
  validateHubtelAmount,
  validateHubtelCurrency,
  validateHubtelReference,
} from "@/lib/payments/hubtel-settlement-rules";
import {
  clearHubtelNoRecordLookup,
  persistHubtelNoRecordFromStatusError,
} from "@/lib/payments/hubtel-no-record";
import { abandonStalePendingPayments } from "@/lib/payments/lifecycle";
import { PaymentSettlementError } from "@/lib/payments/paystack-settlement-rules";
import type {
  PaymentSettlementResult,
  PaymentSettlementSource,
} from "@/lib/payments/settlement";
import {
  claimPaymentFailedTransition,
  claimPaymentSuccessTransition,
  getPaymentByReference,
} from "@/lib/payments/repository";
import { PaymentProvider, PaymentStatus, UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

export const HUBTEL_SETTLEMENT_ACTOR: CurrentUser = {
  uid: "hubtel-automation",
  fullName: "Hubtel Automation",
  serviceNumber: "SYSTEM",
  role: UserRole.ADMIN,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

function resolveSettlementActor(actor?: CurrentUser): CurrentUser {
  return actor ?? HUBTEL_SETTLEMENT_ACTOR;
}

function logSettlement(
  event: string,
  details: Record<string, unknown>,
): void {
  console.info("[hubtel settlement]", event, details);
}

async function runContributionAutomation(
  payment: Awaited<ReturnType<typeof getPaymentByReference>>,
  actor: CurrentUser,
): Promise<void> {
  if (!payment || payment.status !== PaymentStatus.SUCCESS) {
    return;
  }
  await ensureContributionFromPayment(payment, actor);
}

/**
 * Hubtel-only settlement. Never calls Paystack.
 * Browser/callback claims are ignored — Hubtel status API is authoritative.
 */
export async function settlePaymentFromHubtelReference(
  reference: string,
  options: {
    actor?: CurrentUser;
    source?: PaymentSettlementSource;
  } = {},
): Promise<PaymentSettlementResult> {
  const trimmedReference = reference.trim();
  if (!trimmedReference) {
    throw new PaymentSettlementError("Payment reference is required.");
  }

  const actor = resolveSettlementActor(options.actor);
  const source = options.source ?? "verify";

  const payment = await getPaymentByReference(trimmedReference);
  if (!payment) {
    throw new PaymentSettlementError("Payment not found.");
  }

  if (payment.provider !== PaymentProvider.HUBTEL) {
    throw new PaymentSettlementError(
      "Payment provider is not Hubtel; refusing Hubtel settlement path.",
    );
  }

  if (payment.status === PaymentStatus.SUCCESS) {
    logSettlement("already_settled", {
      reference: trimmedReference,
      source,
      outcome: "already_settled",
    });
    await runContributionAutomation(payment, actor);
    return {
      outcome: "already_settled",
      payment,
      message: "Payment was already settled.",
    };
  }

  await abandonStalePendingPayments();

  let verification;
  try {
    verification = await hubtelFetchTransactionStatus(trimmedReference);
  } catch (error) {
    if (isHubtelNoRecordStatusError(error)) {
      // Manual Check status always hits Hubtel; record definitive no-record only.
      // Never invent SUCCESS/FAILED from 4720 alone.
      await persistHubtelNoRecordFromStatusError(
        trimmedReference,
        error,
        "verify",
        actor,
      );
      throw new PaymentSettlementError(error.message, {
        retryable: false,
      });
    }
    if (error instanceof HubtelStatusRequestError) {
      throw new PaymentSettlementError(error.message, {
        retryable: error.retryable,
      });
    }
    throw error;
  }

  await clearHubtelNoRecordLookup(trimmedReference);

  validateHubtelReference(trimmedReference, verification.clientReference);

  if (verification.status !== PaymentStatus.SUCCESS) {
    // Unpaid / Pending / Unknown: leave as pending (do not invent failure).
    // Refunded / Failed: persist FAILED when Hubtel is definitive.
    if (
      verification.lifecycleStatus === "Refunded" ||
      verification.lifecycleStatus === "Failed"
    ) {
      const updated = await claimPaymentFailedTransition(trimmedReference, {
        providerReference: verification.providerReference,
      });
      logSettlement("non_success_status", {
        reference: trimmedReference,
        source,
        lifecycleStatus: verification.lifecycleStatus,
      });
      return {
        outcome: "failed",
        payment: updated,
        message: `Hubtel reported status: ${verification.rawStatus ?? verification.lifecycleStatus}.`,
      };
    }

    logSettlement("still_pending", {
      reference: trimmedReference,
      source,
      lifecycleStatus: verification.lifecycleStatus,
    });
    return {
      outcome: "pending",
      payment,
      message: `Hubtel reported status: ${verification.rawStatus ?? verification.lifecycleStatus}.`,
    };
  }

  validateHubtelAmount(payment, verification);
  validateHubtelCurrency(payment, verification.currency);

  const claim = await claimPaymentSuccessTransition(trimmedReference, {
    providerReference: verification.providerReference,
    paidAt: verification.paidAt,
  });

  if (claim.outcome === "already_settled") {
    logSettlement("already_settled", {
      reference: trimmedReference,
      source,
      outcome: "already_settled",
      note: "lost_success_claim_race",
    });
    await runContributionAutomation(claim.payment, actor);
    return {
      outcome: "already_settled",
      payment: claim.payment,
      message: "Payment was already settled.",
    };
  }

  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_VERIFIED,
    entityType: "payment",
    entityId: trimmedReference,
    ...buildAuditActor(actor),
    metadata: {
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber,
      amount: payment.amount,
      checkoutAmount: payment.checkoutAmount ?? null,
      processingFeeAmount: payment.processingFeeAmount ?? null,
      currency: payment.currency,
      reference: trimmedReference,
      status: PaymentStatus.SUCCESS,
      provider: PaymentProvider.HUBTEL,
      providerReference: verification.providerReference,
      settlementSource: source,
      hubtelLifecycleStatus: verification.lifecycleStatus,
      hubtelAmount: verification.amount,
      hubtelCurrency: verification.currency,
    },
  });

  await runContributionAutomation(claim.payment, actor);

  logSettlement("settled", {
    reference: trimmedReference,
    source,
    amount: payment.amount,
    checkoutAmount: payment.checkoutAmount ?? null,
    processingFeeAmount: payment.processingFeeAmount ?? null,
    hubtelAmount: verification.amount,
    currency: payment.currency,
  });

  return {
    outcome: "settled",
    payment: claim.payment,
    message: "Payment settled successfully.",
  };
}
