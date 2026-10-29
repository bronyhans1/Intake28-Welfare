import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import {
  paystackVerifyTransaction,
  PaystackRequestError,
} from "@/lib/integrations/paystack/client";
import {
  PaymentSettlementError,
  validatePaystackBusinessAmount,
  validatePaystackCurrency,
  validatePaystackReference,
  resolvePaystackBusinessAmountMinor,
} from "@/lib/payments/paystack-settlement-rules";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { ensureContributionFromPayment } from "@/lib/payments/contribution-automation";
import { abandonStalePendingPayments } from "@/lib/payments/lifecycle";
import {
  claimPaymentSuccessTransition,
  getPaymentByReference,
  updatePaymentStatus,
} from "@/lib/payments/repository";
import { PaymentProvider, PaymentStatus, UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { SerializedPayment } from "@/types/payment";
import { settlePaymentFromHubtelReference } from "@/lib/payments/hubtel-settlement";

export { PaymentSettlementError } from "@/lib/payments/paystack-settlement-rules";
export { settlePaymentFromHubtelReference } from "@/lib/payments/hubtel-settlement";

export type PaymentSettlementSource = "verify" | "callback" | "webhook" | "recovery";

export type PaymentSettlementOutcome =
  | "settled"
  | "already_settled"
  | "failed"
  | "pending"
  | "verification_rejected";

export interface PaymentSettlementResult {
  outcome: PaymentSettlementOutcome;
  payment: SerializedPayment;
  message?: string;
}

/** Automation actor for callback/webhook settlement audit trails. */
export const PAYSTACK_SETTLEMENT_ACTOR: CurrentUser = {
  uid: "paystack-automation",
  fullName: "Paystack Automation",
  serviceNumber: "SYSTEM",
  role: UserRole.ADMIN,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

function resolveSettlementActor(actor?: CurrentUser): CurrentUser {
  return actor ?? PAYSTACK_SETTLEMENT_ACTOR;
}

function logSettlement(
  event: string,
  details: Record<string, unknown>,
): void {
  console.info("[paystack settlement]", event, details);
}

async function runContributionAutomation(
  payment: SerializedPayment,
  actor: CurrentUser,
): Promise<void> {
  if (payment.status !== PaymentStatus.SUCCESS) {
    return;
  }
  await ensureContributionFromPayment(payment, actor);
}

/**
 * Shared Paystack settlement path for verify, callback, and webhook.
 * ONE reference → ONE successful settlement.
 */
export async function settlePaymentFromPaystackReference(
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

  if (payment.provider === PaymentProvider.HUBTEL) {
    throw new PaymentSettlementError(
      "Hubtel payment references must not be verified through Paystack.",
    );
  }

  if (payment.provider !== PaymentProvider.PAYSTACK) {
    throw new PaymentSettlementError(
      "Payment provider is not Paystack; refusing Paystack settlement path.",
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
    verification = await paystackVerifyTransaction(trimmedReference);
  } catch (error) {
    if (error instanceof PaystackRequestError) {
      // Transient verify/API failures must remain retryable for webhook delivery.
      throw new PaymentSettlementError(error.message, { retryable: true });
    }
    throw error;
  }

  validatePaystackReference(trimmedReference, verification.providerReference);

  if (verification.status !== PaymentStatus.SUCCESS) {
    const updated = await updatePaymentStatus(trimmedReference, {
      status: verification.status,
      providerReference: verification.providerReference,
      paidAt: verification.paidAt,
    });

    logSettlement("non_success_status", {
      reference: trimmedReference,
      source,
      status: verification.status,
    });

    return {
      outcome:
        verification.status === PaymentStatus.FAILED
          ? "failed"
          : "pending",
      payment: updated,
      message: `Paystack reported status: ${verification.status}.`,
    };
  }

  validatePaystackBusinessAmount(payment, verification);
  validatePaystackCurrency(payment, verification.currency);

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
      currency: payment.currency,
      reference: trimmedReference,
      status: PaymentStatus.SUCCESS,
      providerReference: verification.providerReference,
      settlementSource: source,
      paystackAmount: verification.amount,
      paystackRequestedAmount: verification.requestedAmount,
      paystackFees: verification.fees,
      paystackBusinessAmount: resolvePaystackBusinessAmountMinor(verification),
      paystackCurrency: verification.currency,
    },
  });

  await runContributionAutomation(claim.payment, actor);

  logSettlement("settled", {
    reference: trimmedReference,
    source,
    amount: payment.amount,
    currency: payment.currency,
  });

  return {
    outcome: "settled",
    payment: claim.payment,
    message: "Payment settled successfully.",
  };
}

/**
 * Provider-routed settlement. Hubtel refs never call Paystack verify.
 */
export async function settlePaymentByReference(
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

  const payment = await getPaymentByReference(trimmedReference);
  if (!payment) {
    throw new PaymentSettlementError("Payment not found.");
  }

  if (payment.provider === PaymentProvider.HUBTEL) {
    return settlePaymentFromHubtelReference(trimmedReference, options);
  }

  if (payment.provider === PaymentProvider.PAYSTACK) {
    return settlePaymentFromPaystackReference(trimmedReference, options);
  }

  throw new PaymentSettlementError(
    "Online settlement is not supported for this payment provider.",
  );
}
