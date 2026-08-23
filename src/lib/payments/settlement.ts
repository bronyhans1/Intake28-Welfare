import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import {
  normalizePaystackCurrency,
  toPaystackMinorUnits,
} from "@/lib/integrations/paystack/webhook-signature";
import {
  paystackVerifyTransaction,
  PaystackRequestError,
} from "@/lib/integrations/paystack/client";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { ensureContributionFromPayment } from "@/lib/payments/contribution-automation";
import { abandonStalePendingPayments } from "@/lib/payments/lifecycle";
import {
  getPaymentByReference,
  updatePaymentStatus,
} from "@/lib/payments/repository";
import { PaymentStatus, UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { SerializedPayment } from "@/types/payment";

export class PaymentSettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentSettlementError";
  }
}

export type PaymentSettlementSource = "verify" | "callback" | "webhook";

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

function validatePaystackReference(
  expectedReference: string,
  providerReference: string,
): void {
  if (providerReference !== expectedReference) {
    throw new PaymentSettlementError(
      "Paystack reference does not match the expected payment reference.",
    );
  }
}

function validatePaystackAmount(
  payment: SerializedPayment,
  paystackAmountMinor: number,
): void {
  const expectedMinor = toPaystackMinorUnits(payment.amount);
  if (paystackAmountMinor !== expectedMinor) {
    throw new PaymentSettlementError(
      "Paystack amount does not match the expected payment amount.",
    );
  }
}

function validatePaystackCurrency(
  payment: SerializedPayment,
  paystackCurrency: string,
): void {
  if (
    normalizePaystackCurrency(paystackCurrency) !==
    normalizePaystackCurrency(payment.currency)
  ) {
    throw new PaymentSettlementError(
      "Paystack currency does not match the expected payment currency.",
    );
  }
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
      throw new PaymentSettlementError(error.message);
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

  validatePaystackAmount(payment, verification.amount);
  validatePaystackCurrency(payment, verification.currency);

  const updated = await updatePaymentStatus(trimmedReference, {
    status: PaymentStatus.SUCCESS,
    providerReference: verification.providerReference,
    paidAt: verification.paidAt,
  });

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
      paystackCurrency: verification.currency,
    },
  });

  await runContributionAutomation(updated, actor);

  logSettlement("settled", {
    reference: trimmedReference,
    source,
    amount: payment.amount,
    currency: payment.currency,
  });

  return {
    outcome: "settled",
    payment: updated,
    message: "Payment settled successfully.",
  };
}
