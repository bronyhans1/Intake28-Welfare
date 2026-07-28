/**
 * Membership Claims — Phase 6 finance / payment processing.
 * Creates Payment ledger records; claim stores only paymentId.
 */

import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import {
  canProcessClaimPayments,
  canStartClaimPaymentProcessing,
  canCompleteClaimPayment,
} from "@/lib/claims/claim-access";
import { assertClaimPaymentAmountAllowed } from "@/lib/claims/claim-benefit-amount";
import {
  appendClaimLifecycleAuditHistory,
  buildClaimLifecycleAuditEvent,
  ClaimLifecycleAuditType,
} from "@/lib/claims/claim-lifecycle-audit";
import { getClaimById } from "@/lib/claims/claim-repository";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { createClaimDisbursementPayment } from "@/lib/payments/repository";
import { generatePaymentReference } from "@/lib/payments/reference";
import { getMemberById } from "@/lib/members/repository";
import { deriveMemberPaymentEmailAddress } from "@/lib/payments/member-email";
import { notifyClaimPaid } from "@/lib/notifications/claim-events";
import { getSystemSettings } from "@/lib/system-settings/repository";
import type { CompleteClaimPaymentInput } from "@/lib/validators/claims";
import { ClaimStatus, type PaymentMethod } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

function requireFinancePermission(actor: CurrentUser): void {
  if (!canProcessClaimPayments(actor.role)) {
    throw new Error("You do not have permission to process claim payments.");
  }
}

export async function startClaimPaymentProcessing(
  claimId: string,
  actor: CurrentUser,
): Promise<void> {
  requireFinancePermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canStartClaimPaymentProcessing(existing.status)) {
    throw new Error(
      "Only claims awaiting payment can start payment processing.",
    );
  }

  const event = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.PAYMENT_PROCESSING_STARTED,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      previousStatus: existing.status,
      approvedBenefitAmount: existing.approvedBenefitAmount ?? null,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    event,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.PAYMENT_PROCESSING,
    paymentProcessingById: actor.uid,
    paymentProcessingByName: actor.fullName,
    paymentProcessingAt: FieldValue.serverTimestamp(),
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("startClaimPaymentProcessing", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_PAYMENT_PROCESSING_STARTED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
    },
  });
}

export async function completeClaimPayment(
  claimId: string,
  input: Omit<CompleteClaimPaymentInput, "claimId">,
  actor: CurrentUser,
): Promise<{ paymentId: string }> {
  requireFinancePermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canCompleteClaimPayment(existing.status)) {
    throw new Error(
      "Only claims in Payment Processing can be marked as paid.",
    );
  }
  if (existing.paymentId) {
    throw new Error("This claim already has a linked payment record.");
  }
  if (!existing.claimNumber) {
    throw new Error("Claim number is missing; cannot complete payment.");
  }

  const approvedBenefitAmount = existing.approvedBenefitAmount;
  if (
    typeof approvedBenefitAmount !== "number" ||
    !(approvedBenefitAmount > 0)
  ) {
    throw new Error("Approved benefit amount is missing on this claim.");
  }

  assertClaimPaymentAmountAllowed({
    approvedBenefitAmount,
    paymentAmount: input.amount,
    reductionReason: input.amountReductionReason,
  });

  const settings = await getSystemSettings();
  const paymentDate = new Date(`${input.paymentDate}T12:00:00`);
  if (Number.isNaN(paymentDate.getTime())) {
    throw new Error("Invalid payment date.");
  }

    const reference =
      input.referenceNumber?.trim() || generatePaymentReference();

  const member = await getMemberById(existing.memberId);
  const memberEmail = member
    ? deriveMemberPaymentEmailAddress(member)
    : `${existing.serviceNumber.replace(/\//g, "")}@payments.local`;

  const payment = await createClaimDisbursementPayment({
    memberId: existing.memberId,
    memberName: existing.memberName,
    serviceNumber: existing.serviceNumber,
    email: memberEmail,
    amount: input.amount,
    currency: settings.currency,
    reference,
    claimId: existing.id,
    claimNumber: existing.claimNumber,
    claimTypeCode: existing.claimTypeCode,
    claimTypeDisplayName: existing.claimTypeDisplayName,
    paymentMethod: input.paymentMethod as PaymentMethod,
    paymentDate,
    financeNotes: input.financeNotes ?? null,
    amountReductionReason:
      input.amount < approvedBenefitAmount
        ? (input.amountReductionReason?.trim() ?? null)
        : null,
    paidById: actor.uid,
    paidByName: actor.fullName,
  });

  const paidEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_PAID,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      paymentId: payment.id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: payment.reference,
      approvedBenefitAmount,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    paidEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.PAID,
    paymentId: payment.id,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("completeClaimPayment", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_PAID,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      paymentId: payment.id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: payment.reference,
    },
  });

  await notifyClaimPaid(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
    input.amount,
  );

  return { paymentId: payment.id };
}

export function parseClaimPaymentDate(value: string): Date {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid payment date.");
  }
  return date;
}
