/**
 * Phase 5 — Welfare Executive review workflow (manual review only; no payments).
 */

import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import {
  canAddExecutiveComment,
  canApproveClaim,
  canAssignClaimExecutive,
  canAssignClaims,
  canRecommendClaim,
  canRejectClaim,
  canReviewClaims,
  canStartClaimReview,
} from "@/lib/claims/claim-access";
import {
  ClaimApprovalDecision,
  resolveExecutiveApprovalAmounts,
  type ClaimApprovalDecision as ClaimApprovalDecisionType,
} from "@/lib/claims/claim-progression";
import {
  appendClaimLifecycleAuditHistory,
  buildClaimLifecycleAuditEvent,
  ClaimLifecycleAuditType,
} from "@/lib/claims/claim-lifecycle-audit";
import { getClaimById } from "@/lib/claims/claim-repository";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  notifyClaimApproved,
  notifyClaimRejected,
  notifyClaimSentToFinance,
} from "@/lib/notifications/claim-events";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { getMemberById } from "@/lib/members/repository";
import type {
  AddExecutiveCommentInput,
  ApproveClaimInput,
  AssignClaimExecutiveInput,
  RejectClaimInput,
} from "@/lib/validators/claims";
import { ClaimCommentVisibility, ClaimStatus, UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { ClaimExecutiveComment } from "@/types/claims";

export interface ClaimExecutiveOption {
  id: string;
  fullName: string;
  role: string;
  serviceNumber: string;
}

function requireReviewPermission(actor: CurrentUser): void {
  if (!canReviewClaims(actor.role)) {
    throw new Error("You do not have permission to review claims.");
  }
}

function requireAssignPermission(actor: CurrentUser): void {
  if (!canAssignClaims(actor.role)) {
    throw new Error("You do not have permission to assign claims.");
  }
}

function nextCommentId(now: Date = new Date()): string {
  return `cec_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
}

function appendExecutiveComment(
  existing: ClaimExecutiveComment[] | null | undefined,
  comment: ClaimExecutiveComment,
): ClaimExecutiveComment[] {
  return [...(existing ?? []), comment];
}

export async function listClaimExecutives(): Promise<ClaimExecutiveOption[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.USERS).get();
  const executives = snapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        fullName: String(data.fullName ?? ""),
        role: String(data.role ?? ""),
        serviceNumber: String(data.serviceNumber ?? ""),
      };
    })
    .filter(
      (user) =>
        (user.role === UserRole.ADMIN || user.role === UserRole.TREASURER) &&
        user.fullName.trim().length > 0,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return executives;
}

export async function startClaimReview(
  claimId: string,
  actor: CurrentUser,
): Promise<void> {
  requireReviewPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canStartClaimReview(existing.status)) {
    throw new Error("Only submitted claims can be moved to Under Review.");
  }

  const reviewEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      previousStatus: existing.status,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    reviewEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.UNDER_REVIEW,
    reviewedById: actor.uid,
    reviewedByName: actor.fullName,
    reviewStartedAt: FieldValue.serverTimestamp(),
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("startClaimReview", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_REVIEW_STARTED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
    },
  });
}

export async function addExecutiveComment(
  claimId: string,
  input: Omit<AddExecutiveCommentInput, "claimId">,
  actor: CurrentUser,
): Promise<void> {
  requireReviewPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canAddExecutiveComment(existing.status)) {
    throw new Error("Comments cannot be added to this claim in its current status.");
  }

  const body = input.body.trim();
  if (!body) {
    throw new Error("Comment text is required.");
  }

  const visibility =
    input.visibility === ClaimCommentVisibility.MEMBER_VISIBLE
      ? ClaimCommentVisibility.MEMBER_VISIBLE
      : ClaimCommentVisibility.INTERNAL;

  const now = new Date();
  const comment: ClaimExecutiveComment = {
    id: nextCommentId(now),
    body,
    visibility,
    authorId: actor.uid,
    authorName: actor.fullName,
    authorRole: actor.role,
    createdAt: now.toISOString(),
  };

  const commentEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.EXECUTIVE_COMMENT_ADDED,
    actor,
    reason: body,
    createdAt: now,
    metadata: {
      claimNumber: existing.claimNumber,
      commentId: comment.id,
      visibility,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    commentEvent,
  );
  const executiveComments = appendExecutiveComment(
    existing.executiveComments,
    comment,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    executiveComments,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("addExecutiveComment", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_EXECUTIVE_COMMENT_ADDED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      commentId: comment.id,
      visibility,
    },
  });
}

export async function recommendClaim(
  claimId: string,
  actor: CurrentUser,
): Promise<void> {
  requireReviewPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canRecommendClaim(existing.status)) {
    throw new Error("Only claims under review can be recommended.");
  }

  const recommendEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_RECOMMENDED,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      previousStatus: existing.status,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    recommendEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.RECOMMENDED,
    recommendedById: actor.uid,
    recommendedByName: actor.fullName,
    recommendedAt: FieldValue.serverTimestamp(),
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("recommendClaim", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_RECOMMENDED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
    },
  });
}

export async function approveClaim(
  claimId: string,
  input: Omit<ApproveClaimInput, "claimId">,
  actor: CurrentUser,
): Promise<void> {
  requireReviewPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canApproveClaim(existing.status)) {
    throw new Error(
      "This claim cannot be approved from its current status.",
    );
  }

  const recommendedAmount =
    existing.recommendedAmount ??
    existing.progressionSnapshot?.recommendedAmount ??
    null;
  const claimCeiling =
    existing.claimCeiling ??
    existing.progressionSnapshot?.claimCeiling ??
    null;

  if (
    typeof recommendedAmount !== "number" ||
    typeof claimCeiling !== "number"
  ) {
    throw new Error(
      "This claim is missing a progression recommendation. Return it for revision so the member can resubmit.",
    );
  }

  const amounts = resolveExecutiveApprovalAmounts({
    decision: input.decision as ClaimApprovalDecisionType,
    recommendedAmount,
    claimCeiling,
    approvedAmount: input.approvedAmount,
    bonusAmount: input.bonusAmount,
    overrideReason: input.overrideReason,
  });

  const approveEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_APPROVED,
    actor,
    reason: amounts.overrideReason,
    metadata: {
      claimNumber: existing.claimNumber,
      previousStatus: existing.status,
      decision: amounts.decision,
      recommendedAmount: amounts.recommendedAmount,
      approvedAmount: amounts.approvedAmount,
      bonusAmount: amounts.bonusAmount,
      finalAmount: amounts.finalAmount,
      approvedBenefitAmount: amounts.finalAmount,
      claimCeiling: amounts.claimCeiling,
      overrideReason: amounts.overrideReason,
    },
  });
  let auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    approveEvent,
  );

  const financeEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_SENT_TO_FINANCE,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      approvedBenefitAmount: amounts.finalAmount,
      finalAmount: amounts.finalAmount,
    },
  });
  auditHistory = appendClaimLifecycleAuditHistory(auditHistory, financeEvent);

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.AWAITING_PAYMENT,
    approvedById: actor.uid,
    approvedByName: actor.fullName,
    approvedAt: FieldValue.serverTimestamp(),
    approvalDecision: amounts.decision,
    recommendedAmount: amounts.recommendedAmount,
    claimCeiling: amounts.claimCeiling,
    approvedAmount: amounts.approvedAmount,
    bonusAmount: amounts.bonusAmount,
    finalAmount: amounts.finalAmount,
    approvedBenefitAmount: amounts.finalAmount,
    overrideReason: amounts.overrideReason,
    financeQueuedAt: FieldValue.serverTimestamp(),
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("approveClaim", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_APPROVED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      decision: amounts.decision,
      recommendedAmount: amounts.recommendedAmount,
      approvedAmount: amounts.approvedAmount,
      bonusAmount: amounts.bonusAmount,
      finalAmount: amounts.finalAmount,
      approvedBenefitAmount: amounts.finalAmount,
      overrideReason: amounts.overrideReason,
      status: ClaimStatus.AWAITING_PAYMENT,
    },
  });

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_SENT_TO_FINANCE,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      approvedBenefitAmount: amounts.finalAmount,
      finalAmount: amounts.finalAmount,
    },
  });

  await notifyClaimApproved(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
  );
  await notifyClaimSentToFinance(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
  );
}

// Keep ClaimApprovalDecision export available for UI
export { ClaimApprovalDecision };

export async function rejectClaim(
  claimId: string,
  input: Omit<RejectClaimInput, "claimId">,
  actor: CurrentUser,
): Promise<void> {
  requireReviewPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canRejectClaim(existing.status)) {
    throw new Error(
      "This claim cannot be rejected from its current status.",
    );
  }

  const rejectionReason = input.rejectionReason.trim();
  if (!rejectionReason) {
    throw new Error("A rejection reason is required.");
  }

  const rejectEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_REJECTED,
    actor,
    reason: rejectionReason,
    metadata: {
      claimNumber: existing.claimNumber,
      previousStatus: existing.status,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    rejectEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.REJECTED,
    rejectedById: actor.uid,
    rejectedByName: actor.fullName,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectionReason,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("rejectClaim", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_REJECTED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      rejectionReason,
    },
  });

  await notifyClaimRejected(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
    rejectionReason,
  );
}

export async function assignClaimExecutive(
  claimId: string,
  input: Omit<AssignClaimExecutiveInput, "claimId">,
  actor: CurrentUser,
): Promise<void> {
  requireAssignPermission(actor);

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (!canAssignClaimExecutive(existing.status)) {
    throw new Error("This claim cannot be assigned in its current status.");
  }

  const assignee = await getMemberById(input.assignedExecutiveId);
  if (!assignee) {
    throw new Error("Assigned executive was not found.");
  }
  if (
    assignee.role !== UserRole.ADMIN &&
    assignee.role !== UserRole.TREASURER
  ) {
    throw new Error("Claims can only be assigned to Welfare Executives.");
  }

  const assignEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.EXECUTIVE_ASSIGNED,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      assignedExecutiveId: assignee.id,
      assignedExecutiveName: assignee.fullName,
      previousAssignedExecutiveId: existing.assignedExecutiveId ?? null,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    assignEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    assignedExecutiveId: assignee.id,
    assignedExecutiveName: assignee.fullName,
    assignedAt: FieldValue.serverTimestamp(),
    assignedById: actor.uid,
    assignedByName: actor.fullName,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("assignClaimExecutive", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_EXECUTIVE_ASSIGNED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      assignedExecutiveId: assignee.id,
      assignedExecutiveName: assignee.fullName,
    },
  });
}
