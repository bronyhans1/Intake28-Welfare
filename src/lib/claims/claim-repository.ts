import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import { allocateClaimNumber } from "@/lib/claims/claim-number";
import {
  assertMemberEligibleToClaim,
  buildClaimProgressionSnapshot,
  evaluateClaimSubmissionEligibility,
} from "@/lib/claims/claim-progression";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type {
  ClaimDraftListQuery,
  CreateClaimDraftInput,
  ReturnClaimForRevisionInput,
  SubmittedClaimsListQuery,
  UpdateClaimDraftInput,
  UpdateClaimRevisionInput,
} from "@/lib/validators/claims";
import { ClaimStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { Claim, SerializedClaim } from "@/types/claims";
import type { UserRole } from "@/types/enums";
import { getClaimTypeConfigByCode } from "@/lib/claims/claim-type-repository";
import {
  appendClaimLifecycleAuditHistory,
  buildClaimLifecycleAuditEvent,
  ClaimLifecycleAuditType,
  resolveReturnReason,
} from "@/lib/claims/claim-lifecycle-audit";
import { isAdminReviewClaimStatus } from "@/lib/claims/claim-access";
import {
  notifyClaimReturned,
  notifyClaimSubmitted,
} from "@/lib/notifications/claim-events";

export {
  canMemberChangeClaimType,
  canMemberDeleteClaim,
  canMemberEditClaimContent,
  isAdminReviewClaimStatus,
} from "@/lib/claims/claim-access";

function mapClaim(id: string, data: Record<string, unknown>): Claim {
  return { id, ...data } as Claim;
}

function serializeClaim(claim: Claim): SerializedClaim {
  const { id, ...rest } = claim;
  return serializeFirestoreDoc<SerializedClaim>(id, rest as Record<string, unknown>);
}

function buildDraftReference(claimId: string): string {
  return `DRAFT-${claimId.slice(0, 8).toUpperCase()}`;
}

function timestampSeconds(value: unknown): number {
  if (value && typeof value === "object" && "seconds" in value) {
    return Number((value as { seconds: number }).seconds) || 0;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  }
  return 0;
}

export function canCreateClaim(role: UserRole): boolean {
  return hasPermission(role, Permission.CREATE_CLAIM);
}

export function canViewOwnClaims(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_OWN_CLAIMS);
}

export function canViewAllClaims(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_ALL_CLAIMS);
}

export interface ClaimListResult {
  claims: SerializedClaim[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getClaimById(
  claimId: string,
): Promise<SerializedClaim | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CLAIMS).doc(claimId).get();
  if (!doc.exists) return null;
  return serializeClaim(mapClaim(doc.id, doc.data() as Record<string, unknown>));
}

export async function getClaimByClaimNumber(
  claimNumber: string,
): Promise<SerializedClaim | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.CLAIMS)
    .where("claimNumber", "==", claimNumber.trim().toUpperCase())
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return serializeClaim(mapClaim(doc.id, doc.data() as Record<string, unknown>));
}

function matchesClaimSearch(claim: Claim, search: string): boolean {
  const needle = search.toLowerCase();
  const statusValue = typeof claim.status === "string" ? claim.status : "";
  const statusLabel = statusValue.replace(/_/g, " ");
  return (
    claim.title.toLowerCase().includes(needle) ||
    claim.description.toLowerCase().includes(needle) ||
    claim.reference.toLowerCase().includes(needle) ||
    (claim.claimNumber ?? "").toLowerCase().includes(needle) ||
    claim.memberName.toLowerCase().includes(needle) ||
    claim.serviceNumber.toLowerCase().includes(needle) ||
    claim.claimTypeCode.toLowerCase().includes(needle) ||
    claim.claimTypeDisplayName.toLowerCase().includes(needle) ||
    (claim.assignedExecutiveName ?? "").toLowerCase().includes(needle) ||
    statusValue.toLowerCase().includes(needle) ||
    statusLabel.includes(needle)
  );
}

/** Exported for unit tests — admin/member submitted-claim search */
export function claimMatchesSearch(
  claim: Pick<
    Claim,
    | "title"
    | "description"
    | "reference"
    | "claimNumber"
    | "memberName"
    | "serviceNumber"
    | "claimTypeCode"
    | "claimTypeDisplayName"
    | "assignedExecutiveName"
    | "status"
  >,
  search: string,
): boolean {
  return matchesClaimSearch(claim as Claim, search);
}

function paginateClaims(
  claims: Claim[],
  page: number,
  pageSize: number,
): ClaimListResult {
  const total = claims.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    claims: claims.slice(start, start + pageSize).map(serializeClaim),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function listMemberClaimDrafts(
  memberId: string,
  query: ClaimDraftListQuery,
): Promise<ClaimListResult> {
  const db = getAdminDb();
  let firestoreQuery = db
    .collection(COLLECTIONS.CLAIMS)
    .where("memberId", "==", memberId);

  if (query.status) {
    firestoreQuery = firestoreQuery.where("status", "==", query.status);
  }

  const snapshot = await firestoreQuery.get();

  let claims = snapshot.docs.map((doc) =>
    mapClaim(doc.id, doc.data() as Record<string, unknown>),
  );

  // Default member list: drafts + full post-submission lifecycle (no payment statuses)
  if (!query.status) {
    claims = claims.filter(
      (claim) =>
        claim.status === ClaimStatus.DRAFT ||
        claim.status === ClaimStatus.SUBMITTED ||
        claim.status === ClaimStatus.NEEDS_REVISION ||
        claim.status === ClaimStatus.UNDER_REVIEW ||
        claim.status === ClaimStatus.RECOMMENDED ||
        claim.status === ClaimStatus.APPROVED ||
        claim.status === ClaimStatus.REJECTED ||
        claim.status === ClaimStatus.AWAITING_PAYMENT ||
        claim.status === ClaimStatus.PAYMENT_PROCESSING ||
        claim.status === ClaimStatus.PAID,
    );
  }

  claims.sort((a, b) => timestampSeconds(b.updatedAt) - timestampSeconds(a.updatedAt));

  if (query.claimTypeCode) {
    claims = claims.filter((claim) => claim.claimTypeCode === query.claimTypeCode);
  }

  if (query.search) {
    claims = claims.filter((claim) => matchesClaimSearch(claim, query.search!));
  }

  return paginateClaims(claims, query.page, query.pageSize);
}

/**
 * Executive dashboard list — filter by status, sort, and search
 * (claim number, member name, claim type, assigned executive, status).
 */
export async function listSubmittedClaims(
  query: SubmittedClaimsListQuery,
): Promise<ClaimListResult> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.CLAIMS).get();

  let claims = snapshot.docs
    .map((doc) => mapClaim(doc.id, doc.data() as Record<string, unknown>))
    .filter((claim) => isAdminReviewClaimStatus(claim.status));

  if (query.status) {
    claims = claims.filter((claim) => claim.status === query.status);
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    claims = claims.filter((claim) => matchesClaimSearch(claim, search));
  }

  const sortDir = query.sortDir === "asc" ? 1 : -1;
  claims.sort((a, b) => {
    if (query.sortBy === "claimNumber") {
      const aNum = (a.claimNumber ?? a.reference ?? "").toLowerCase();
      const bNum = (b.claimNumber ?? b.reference ?? "").toLowerCase();
      return aNum.localeCompare(bNum) * sortDir;
    }
    if (query.sortBy === "claimType") {
      return (
        a.claimTypeDisplayName
          .toLowerCase()
          .localeCompare(b.claimTypeDisplayName.toLowerCase()) * sortDir
      );
    }
    if (query.sortBy === "memberName") {
      return (
        a.memberName.toLowerCase().localeCompare(b.memberName.toLowerCase()) *
        sortDir
      );
    }

    const aTime =
      timestampSeconds(a.resubmittedAt) ||
      timestampSeconds(a.submittedAt) ||
      timestampSeconds(a.updatedAt);
    const bTime =
      timestampSeconds(b.resubmittedAt) ||
      timestampSeconds(b.submittedAt) ||
      timestampSeconds(b.updatedAt);
    return (aTime - bTime) * sortDir;
  });

  return paginateClaims(claims, query.page, query.pageSize);
}

/**
 * Finance queue — awaiting payment / processing / paid claims.
 */
export async function listFinanceClaims(
  query: import("@/lib/validators/claims").FinanceClaimsListQuery,
): Promise<ClaimListResult> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.CLAIMS).get();

  let claims = snapshot.docs
    .map((doc) => mapClaim(doc.id, doc.data() as Record<string, unknown>))
    .filter((claim) =>
      (
        [
          ClaimStatus.AWAITING_PAYMENT,
          ClaimStatus.PAYMENT_PROCESSING,
          ClaimStatus.PAID,
        ] as string[]
      ).includes(claim.status),
    );

  if (query.status) {
    claims = claims.filter((claim) => claim.status === query.status);
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    claims = claims.filter((claim) => matchesClaimSearch(claim, search));
  }

  const sortDir = query.sortDir === "asc" ? 1 : -1;
  claims.sort((a, b) => {
    if (query.sortBy === "memberName") {
      return (
        a.memberName.toLowerCase().localeCompare(b.memberName.toLowerCase()) *
        sortDir
      );
    }
    if (query.sortBy === "amount") {
      const aAmt = a.approvedBenefitAmount ?? 0;
      const bAmt = b.approvedBenefitAmount ?? 0;
      return (aAmt - bAmt) * sortDir;
    }
    if (query.sortBy === "paymentDate") {
      return (
        (timestampSeconds(a.paymentProcessingAt) -
          timestampSeconds(b.paymentProcessingAt)) *
        sortDir
      );
    }
    const aNum = (a.claimNumber ?? a.reference ?? "").toLowerCase();
    const bNum = (b.claimNumber ?? b.reference ?? "").toLowerCase();
    return aNum.localeCompare(bNum) * sortDir;
  });

  return paginateClaims(claims, query.page, query.pageSize);
}

function attachmentFieldsFromInput(input: CreateClaimDraftInput | UpdateClaimDraftInput) {
  return {
    whatsappEvidenceNote: input.whatsappEvidenceNote ?? null,
    attachmentUrl: input.attachmentUrl ?? null,
    attachmentPath: input.attachmentPath ?? null,
    attachmentFileName: input.attachmentFileName ?? null,
    attachmentContentType: input.attachmentContentType ?? null,
  };
}

export async function createClaimDraft(
  input: CreateClaimDraftInput,
  actor: CurrentUser,
): Promise<{ claimId: string }> {
  const claimType = await getClaimTypeConfigByCode(input.claimTypeCode);
  if (!claimType) {
    throw new Error("Selected claim type was not found.");
  }
  if (!claimType.active) {
    throw new Error("Selected claim type is not active.");
  }
  if (!claimType.allowDrafts) {
    throw new Error("This claim type does not allow drafts.");
  }

  await assertMemberEligibleToClaim(actor.uid);

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.CLAIMS).doc();
  const reference = buildDraftReference(ref.id);

  const createdEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_CREATED,
    actor,
    metadata: {
      claimTypeCode: claimType.code,
      reference,
    },
  });

  const payload = sanitizeFirestoreData({
    reference,
    claimNumber: null,
    memberId: actor.uid,
    memberName: actor.fullName,
    serviceNumber: actor.serviceNumber,
    claimTypeCode: claimType.code,
    claimTypeDisplayName: claimType.displayName,
    status: ClaimStatus.DRAFT,
    title: input.title.trim(),
    description: input.description.trim(),
    incidentDate: input.incidentDate ?? null,
    requestedAmount: input.requestedAmount ?? null,
    ...attachmentFieldsFromInput(input),
    eligibilitySnapshot: null,
    progressionSnapshot: null,
    recommendedAmount: null,
    claimCeiling: null,
    auditHistory: [createdEvent],
    executiveComments: [],
    submittedAt: null,
    returnedAt: null,
    returnedById: null,
    returnedByName: null,
    returnReason: null,
    resubmittedAt: null,
    resubmittedById: null,
    resubmittedByName: null,
    reviewStartedAt: null,
    reviewedById: null,
    reviewedByName: null,
    recommendedAt: null,
    recommendedById: null,
    recommendedByName: null,
    approvedAt: null,
    approvedById: null,
    approvedByName: null,
    rejectedAt: null,
    rejectedById: null,
    rejectedByName: null,
    rejectionReason: null,
    approvedBenefitAmount: null,
    approvedAmount: null,
    bonusAmount: null,
    finalAmount: null,
    approvalDecision: null,
    overrideReason: null,
    paymentId: null,
    financeQueuedAt: null,
    paymentProcessingAt: null,
    paymentProcessingById: null,
    paymentProcessingByName: null,
    assignedExecutiveId: null,
    assignedExecutiveName: null,
    assignedAt: null,
    assignedById: null,
    assignedByName: null,
    currency: "GHS",
    createdBy: actor.uid,
    createdByName: actor.fullName,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createClaimDraft", payload);
  await ref.set(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_DRAFT_CREATED,
    entityType: "claim",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: {
      reference,
      claimTypeCode: claimType.code,
      serviceNumber: actor.serviceNumber,
      fullName: actor.fullName,
    },
  });

  return { claimId: ref.id };
}

export async function updateClaimDraft(
  claimId: string,
  input: UpdateClaimDraftInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim draft not found.");
  }
  if (existing.memberId !== actor.uid) {
    throw new Error("You can only update your own claim drafts.");
  }
  if (existing.status !== ClaimStatus.DRAFT) {
    throw new Error(
      "This claim has been submitted and can no longer be edited as a draft.",
    );
  }

  const claimType = await getClaimTypeConfigByCode(input.claimTypeCode);
  if (!claimType) {
    throw new Error("Selected claim type was not found.");
  }
  if (!claimType.active && claimType.code !== existing.claimTypeCode) {
    throw new Error("Selected claim type is not active.");
  }

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    claimTypeCode: claimType.code,
    claimTypeDisplayName: claimType.displayName,
    title: input.title.trim(),
    description: input.description.trim(),
    incidentDate: input.incidentDate ?? null,
    requestedAmount: input.requestedAmount ?? null,
    ...attachmentFieldsFromInput(input),
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateClaimDraft", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_DRAFT_UPDATED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    changes: {
      title: { before: existing.title, after: input.title.trim() },
      claimTypeCode: {
        before: existing.claimTypeCode,
        after: claimType.code,
      },
    },
    metadata: {
      reference: existing.reference,
      serviceNumber: actor.serviceNumber,
    },
  });
}

export async function deleteClaimDraft(
  claimId: string,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim draft not found.");
  }
  if (existing.memberId !== actor.uid) {
    throw new Error("You can only delete your own claim drafts.");
  }
  if (existing.status !== ClaimStatus.DRAFT) {
    throw new Error(
      "This claim has been submitted and can no longer be deleted.",
    );
  }

  const db = getAdminDb();
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).delete();

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_DRAFT_DELETED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      reference: existing.reference,
      claimTypeCode: existing.claimTypeCode,
      serviceNumber: actor.serviceNumber,
    },
  });
}

/**
 * Submit a draft claim. Always re-evaluates eligibility via the Eligibility Engine.
 * On success: permanent claim number, status = submitted.
 */
export async function submitClaimDraft(
  claimId: string,
  actor: CurrentUser,
): Promise<{ claimId: string; claimNumber: string }> {
  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim draft not found.");
  }
  if (existing.memberId !== actor.uid) {
    throw new Error("You can only submit your own claim drafts.");
  }
  if (existing.status !== ClaimStatus.DRAFT) {
    throw new Error("Only draft claims can be submitted.");
  }
  if (!existing.title?.trim() || !existing.description?.trim()) {
    throw new Error("Title and description are required before submitting.");
  }
  if (!existing.incidentDate?.trim()) {
    throw new Error("Incident date is required before submitting.");
  }

  const eligibility = await evaluateClaimSubmissionEligibility({
    memberId: actor.uid,
    claimTypeCode: existing.claimTypeCode,
  });

  if ("error" in eligibility) {
    throw new Error(eligibility.error);
  }

  if (!eligibility.eligible || !eligibility.progression) {
    throw new Error(
      eligibility.reasons[0] ??
        "You cannot submit this claim until the eligibility requirements have been met.",
    );
  }

  if (
    eligibility.recommendedAmount == null ||
    eligibility.claimCeiling == null
  ) {
    throw new Error(
      eligibility.reasons[0] ??
        "Recommended benefit amount could not be calculated for this claim type.",
    );
  }

  const progressionSnapshot = buildClaimProgressionSnapshot({
    progression: eligibility.progression,
    recommendedAmount: eligibility.recommendedAmount,
    claimCeiling: eligibility.claimCeiling,
  });

  const claimNumber = await allocateClaimNumber();
  const checkedAt = progressionSnapshot.calculatedAt;
  const submittedEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
    actor,
    metadata: {
      claimNumber,
      claimTypeCode: existing.claimTypeCode,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      welfarePoints: progressionSnapshot.welfarePoints,
      recommendedAmount: progressionSnapshot.recommendedAmount,
      constitutionVersion: eligibility.constitutionVersion,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    submittedEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.SUBMITTED,
    claimNumber,
    reference: claimNumber,
    submittedAt: FieldValue.serverTimestamp(),
    eligibilitySnapshot: {
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      warnings: eligibility.warnings,
      memberStatus: eligibility.memberStatus,
      constitutionVersion: eligibility.constitutionVersion,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      checkedAt,
    },
    progressionSnapshot,
    recommendedAmount: progressionSnapshot.recommendedAmount,
    claimCeiling: progressionSnapshot.claimCeiling,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("submitClaimDraft", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_SUBMITTED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber,
      claimTypeCode: existing.claimTypeCode,
      serviceNumber: actor.serviceNumber,
      fullName: actor.fullName,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      welfarePoints: progressionSnapshot.welfarePoints,
      recommendedAmount: progressionSnapshot.recommendedAmount,
      constitutionVersion: eligibility.constitutionVersion,
    },
  });

  await notifyClaimSubmitted(
    {
      id: claimId,
      claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
  );

  return { claimId, claimNumber };
}

/**
 * Member updates a claim that was returned for revision.
 * Claim type and claim number cannot change.
 */
export async function updateClaimRevision(
  claimId: string,
  input: UpdateClaimRevisionInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (existing.memberId !== actor.uid) {
    throw new Error("You can only update your own claims.");
  }
  if (existing.status !== ClaimStatus.NEEDS_REVISION) {
    throw new Error(
      "This claim can only be edited while it is returned for revision.",
    );
  }

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    title: input.title.trim(),
    description: input.description.trim(),
    incidentDate: input.incidentDate,
    whatsappEvidenceNote: input.whatsappEvidenceNote ?? null,
    attachmentUrl: input.attachmentUrl ?? null,
    attachmentPath: input.attachmentPath ?? null,
    attachmentFileName: input.attachmentFileName ?? null,
    attachmentContentType: input.attachmentContentType ?? null,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateClaimRevision", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_REVISION_UPDATED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    changes: {
      title: { before: existing.title, after: input.title.trim() },
    },
    metadata: {
      claimNumber: existing.claimNumber,
      status: existing.status,
    },
  });
}

/**
 * Administrator returns a submitted claim for member revision.
 */
export async function returnClaimForRevision(
  claimId: string,
  input: Omit<ReturnClaimForRevisionInput, "claimId">,
  actor: CurrentUser,
): Promise<void> {
  if (!canViewAllClaims(actor.role)) {
    throw new Error("You do not have permission to return claims for revision.");
  }

  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (existing.status !== ClaimStatus.SUBMITTED) {
    throw new Error("Only submitted claims can be returned for revision.");
  }

  const reason = resolveReturnReason({
    reasonPreset: input.reasonPreset,
    customReason: input.customReason,
  });

  const returnedEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_RETURNED_FOR_REVISION,
    actor,
    reason,
    metadata: {
      claimNumber: existing.claimNumber,
      reasonPreset: input.reasonPreset,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    returnedEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.NEEDS_REVISION,
    returnReason: reason,
    returnedById: actor.uid,
    returnedByName: actor.fullName,
    returnedAt: FieldValue.serverTimestamp(),
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("returnClaimForRevision", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_RETURNED_FOR_REVISION,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      reason,
      memberId: existing.memberId,
      serviceNumber: existing.serviceNumber,
    },
  });

  await notifyClaimReturned(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
    reason,
  );
}

/**
 * Member resubmits a claim after revision.
 * Re-runs Eligibility Engine. Preserves claim number and original submittedAt.
 */
export async function resubmitClaim(
  claimId: string,
  actor: CurrentUser,
): Promise<{ claimId: string; claimNumber: string }> {
  const existing = await getClaimById(claimId);
  if (!existing) {
    throw new Error("Claim not found.");
  }
  if (existing.memberId !== actor.uid) {
    throw new Error("You can only resubmit your own claims.");
  }
  if (existing.status !== ClaimStatus.NEEDS_REVISION) {
    throw new Error("Only claims returned for revision can be resubmitted.");
  }
  if (!existing.claimNumber) {
    throw new Error("Claim number is missing; cannot resubmit.");
  }
  if (!existing.title?.trim() || !existing.description?.trim()) {
    throw new Error("Title and description are required before resubmitting.");
  }
  if (!existing.incidentDate?.trim()) {
    throw new Error("Incident date is required before resubmitting.");
  }

  const eligibility = await evaluateClaimSubmissionEligibility({
    memberId: actor.uid,
    claimTypeCode: existing.claimTypeCode,
  });

  if ("error" in eligibility) {
    throw new Error(eligibility.error);
  }

  if (!eligibility.eligible || !eligibility.progression) {
    throw new Error(
      eligibility.reasons[0] ??
        "You cannot resubmit this claim until the eligibility requirements have been met.",
    );
  }

  if (
    eligibility.recommendedAmount == null ||
    eligibility.claimCeiling == null
  ) {
    throw new Error(
      eligibility.reasons[0] ??
        "Recommended benefit amount could not be calculated for this claim type.",
    );
  }

  const progressionSnapshot = buildClaimProgressionSnapshot({
    progression: eligibility.progression,
    recommendedAmount: eligibility.recommendedAmount,
    claimCeiling: eligibility.claimCeiling,
  });

  const checkedAt = progressionSnapshot.calculatedAt;
  const resubmittedEvent = buildClaimLifecycleAuditEvent({
    type: ClaimLifecycleAuditType.CLAIM_RESUBMITTED,
    actor,
    metadata: {
      claimNumber: existing.claimNumber,
      claimTypeCode: existing.claimTypeCode,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      welfarePoints: progressionSnapshot.welfarePoints,
      recommendedAmount: progressionSnapshot.recommendedAmount,
      constitutionVersion: eligibility.constitutionVersion,
      originalSubmittedAt: existing.submittedAt ?? null,
    },
  });
  const auditHistory = appendClaimLifecycleAuditHistory(
    existing.auditHistory,
    resubmittedEvent,
  );

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    status: ClaimStatus.SUBMITTED,
    // Permanent — never regenerate or overwrite claimNumber / submittedAt
    claimNumber: existing.claimNumber,
    reference: existing.claimNumber,
    eligibilitySnapshot: {
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      warnings: eligibility.warnings,
      memberStatus: eligibility.memberStatus,
      constitutionVersion: eligibility.constitutionVersion,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      checkedAt,
    },
    progressionSnapshot,
    recommendedAmount: progressionSnapshot.recommendedAmount,
    claimCeiling: progressionSnapshot.claimCeiling,
    returnReason: null,
    resubmittedAt: FieldValue.serverTimestamp(),
    resubmittedById: actor.uid,
    resubmittedByName: actor.fullName,
    auditHistory,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("resubmitClaim", payload);
  await db.collection(COLLECTIONS.CLAIMS).doc(claimId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_RESUBMITTED,
    entityType: "claim",
    entityId: claimId,
    ...buildAuditActor(actor),
    metadata: {
      claimNumber: existing.claimNumber,
      claimTypeCode: existing.claimTypeCode,
      serviceNumber: actor.serviceNumber,
      benefitPercentage: progressionSnapshot.benefitPercentage,
      welfarePoints: progressionSnapshot.welfarePoints,
      recommendedAmount: progressionSnapshot.recommendedAmount,
    },
  });

  await notifyClaimSubmitted(
    {
      id: claimId,
      claimNumber: existing.claimNumber,
      memberId: existing.memberId,
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
    },
    actor,
  );

  return { claimId, claimNumber: existing.claimNumber };
}
