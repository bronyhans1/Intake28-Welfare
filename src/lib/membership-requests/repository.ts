import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { MembershipRequestAuditAction } from "@/lib/membership-requests/audit";
import {
  notifyMembershipRequestApproved,
  notifyMembershipRequestDeclined,
  notifyNewMembershipRequest,
} from "@/lib/notifications/membership-request-events";
import {
  createMember,
  findMemberByPhoneNumber,
  findMemberByServiceNumber,
  findMemberByServiceNumberSuffix,
} from "@/lib/members/repository";
import {
  assertRequestIsPending,
  buildMemberCreateInputFromRequest,
  evaluateRequestAccessEligibility,
  findDuplicatePendingRequest,
  MembershipRequestConflictError,
} from "@/lib/membership-requests/duplicates";
import {
  formatServiceNumber,
  normalizeServiceNumberSuffix,
} from "@/lib/utils/service-number";
import { UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type {
  ApproveMembershipRequestInput,
  DeclineMembershipRequestInput,
  MembershipRequestListQuery,
  SubmitMembershipRequestInput,
} from "@/lib/validators/membership-request";
import {
  MembershipRequestStatus,
  type MembershipRequest,
  type SerializedMembershipRequest,
} from "@/types/membership-request";

function mapDoc(id: string, data: Record<string, unknown>): MembershipRequest {
  return { id, ...data } as MembershipRequest;
}

function serializeRequest(
  record: MembershipRequest,
): SerializedMembershipRequest {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedMembershipRequest>(
    id,
    rest as Record<string, unknown>,
  );
}

export function canViewMembershipRequests(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_MEMBERSHIP_REQUESTS);
}

export function canReviewMembershipRequests(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.REVIEW_MEMBERSHIP_REQUESTS);
}

async function fetchAllRequests(): Promise<MembershipRequest[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.MEMBERSHIP_REQUESTS).get();
  return snapshot.docs.map((doc) =>
    mapDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function getMembershipRequestById(
  requestId: string,
): Promise<SerializedMembershipRequest | null> {
  const db = getAdminDb();
  const doc = await db
    .collection(COLLECTIONS.MEMBERSHIP_REQUESTS)
    .doc(requestId)
    .get();
  if (!doc.exists) return null;
  return serializeRequest(mapDoc(doc.id, doc.data() as Record<string, unknown>));
}

function matchesSearch(request: MembershipRequest, search: string): boolean {
  const needle = search.toLowerCase();
  return (
    request.fullName.toLowerCase().includes(needle) ||
    request.serviceNumber.toLowerCase().includes(needle) ||
    request.serviceNumberSuffix.toLowerCase().includes(needle) ||
    request.phoneNumber.toLowerCase().includes(needle) ||
    request.status.toLowerCase().includes(needle)
  );
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

export interface MembershipRequestListResult {
  requests: SerializedMembershipRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listMembershipRequests(
  query: MembershipRequestListQuery,
): Promise<MembershipRequestListResult> {
  let requests = await fetchAllRequests();

  if (query.status) {
    requests = requests.filter((request) => request.status === query.status);
  }

  if (query.search?.trim()) {
    requests = requests.filter((request) =>
      matchesSearch(request, query.search!.trim()),
    );
  }

  requests.sort((a, b) => {
    if (query.sort === "name") {
      return a.fullName.localeCompare(b.fullName);
    }
    const diff =
      timestampSeconds(b.submittedAt) - timestampSeconds(a.submittedAt);
    return query.sort === "oldest" ? -diff : diff;
  });

  const total = requests.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    requests: requests
      .slice(start, start + query.pageSize)
      .map(serializeRequest),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

async function assertNoExistingMemberForRequest(input: {
  serviceNumber: string;
  serviceNumberSuffix: string;
  phoneNumber: string;
}): Promise<void> {
  const existing =
    (await findMemberByServiceNumber(input.serviceNumber)) ??
    (await findMemberByServiceNumberSuffix(input.serviceNumberSuffix)) ??
    (await findMemberByPhoneNumber(input.phoneNumber));

  const eligibility = evaluateRequestAccessEligibility({
    existingMember: existing,
    hasPendingRequest: false,
  });

  if (!eligibility.allowed) {
    throw new MembershipRequestConflictError(
      eligibility.message,
      eligibility.nextAction,
    );
  }
}

async function assertNoDuplicatePendingRequest(input: {
  serviceNumber: string;
  phoneNumber: string;
}): Promise<void> {
  const requests = await fetchAllRequests();
  const duplicate = findDuplicatePendingRequest(requests, input);

  const eligibility = evaluateRequestAccessEligibility({
    existingMember: null,
    hasPendingRequest: Boolean(duplicate),
  });

  if (!eligibility.allowed) {
    throw new MembershipRequestConflictError(
      eligibility.message,
      eligibility.nextAction,
    );
  }
}

/**
 * Public submission — no authenticated actor.
 * Validation order:
 * 1. Existing member (service number or phone) → block
 * 2. Pending membership request → block
 * 3. Create request
 */
export async function submitMembershipRequest(
  input: SubmitMembershipRequestInput,
): Promise<{ requestId: string }> {
  const serviceNumberSuffix = normalizeServiceNumberSuffix(
    input.serviceNumberSuffix,
  );
  const serviceNumber = formatServiceNumber(serviceNumberSuffix);

  await assertNoExistingMemberForRequest({
    serviceNumber,
    serviceNumberSuffix,
    phoneNumber: input.phoneNumber,
  });

  await assertNoDuplicatePendingRequest({
    serviceNumber,
    phoneNumber: input.phoneNumber,
  });

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.MEMBERSHIP_REQUESTS).doc();

  const payload = sanitizeFirestoreData({
    fullName: input.fullName.trim(),
    serviceNumber,
    serviceNumberSuffix,
    phoneNumber: input.phoneNumber,
    status: MembershipRequestStatus.PENDING,
    submittedAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
    reviewedById: null,
    reviewedByName: null,
    reviewRemarks: null,
    memberId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("submitMembershipRequest", payload);
  await ref.set(payload);

  await createAuditLog({
    action: MembershipRequestAuditAction.MEMBERSHIP_REQUEST_SUBMITTED,
    entityType: "membership_request",
    entityId: ref.id,
    ...buildAuditActor({
      uid: "public",
      fullName: input.fullName.trim(),
      role: UserRole.MEMBER,
    }),
    metadata: {
      serviceNumber,
      phoneNumber: input.phoneNumber,
      fullName: input.fullName.trim(),
    },
  });

  await notifyNewMembershipRequest({
    requestId: ref.id,
    fullName: input.fullName.trim(),
    serviceNumber,
  });

  return { requestId: ref.id };
}

export async function approveMembershipRequest(
  input: ApproveMembershipRequestInput,
  actor: CurrentUser,
): Promise<{ memberId: string }> {
  if (!canReviewMembershipRequests(actor.role)) {
    throw new Error("You do not have permission to review membership requests.");
  }

  const existing = await getMembershipRequestById(input.requestId);
  if (!existing) {
    throw new Error("Membership request not found.");
  }
  assertRequestIsPending(existing.status, "approved");

  const { memberId } = await createMember(
    buildMemberCreateInputFromRequest(existing),
    actor,
  );

  const db = getAdminDb();
  const remarks = input.remarks?.trim() || null;
  await db.collection(COLLECTIONS.MEMBERSHIP_REQUESTS).doc(input.requestId).update(
    sanitizeFirestoreData({
      status: MembershipRequestStatus.APPROVED,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedById: actor.uid,
      reviewedByName: actor.fullName,
      reviewRemarks: remarks,
      memberId,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  await createAuditLog({
    action: MembershipRequestAuditAction.MEMBERSHIP_REQUEST_APPROVED,
    entityType: "membership_request",
    entityId: input.requestId,
    ...buildAuditActor(actor),
    metadata: {
      memberId,
      serviceNumber: existing.serviceNumber,
      remarks,
    },
  });

  await createAuditLog({
    action: MembershipRequestAuditAction.MEMBER_CREATED_FROM_REQUEST,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    metadata: {
      requestId: input.requestId,
      serviceNumber: existing.serviceNumber,
      fullName: existing.fullName,
    },
  });

  await notifyMembershipRequestApproved({
    memberId,
    fullName: existing.fullName,
    serviceNumber: existing.serviceNumber,
    actor,
  });

  return { memberId };
}

export async function declineMembershipRequest(
  input: DeclineMembershipRequestInput,
  actor: CurrentUser,
): Promise<void> {
  if (!canReviewMembershipRequests(actor.role)) {
    throw new Error("You do not have permission to review membership requests.");
  }

  const existing = await getMembershipRequestById(input.requestId);
  if (!existing) {
    throw new Error("Membership request not found.");
  }
  assertRequestIsPending(existing.status, "declined");

  const remarks = input.remarks.trim();
  const db = getAdminDb();
  await db.collection(COLLECTIONS.MEMBERSHIP_REQUESTS).doc(input.requestId).update(
    sanitizeFirestoreData({
      status: MembershipRequestStatus.DECLINED,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedById: actor.uid,
      reviewedByName: actor.fullName,
      reviewRemarks: remarks,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  await createAuditLog({
    action: MembershipRequestAuditAction.MEMBERSHIP_REQUEST_DECLINED,
    entityType: "membership_request",
    entityId: input.requestId,
    ...buildAuditActor(actor),
    metadata: {
      serviceNumber: existing.serviceNumber,
      remarks,
    },
  });

  await notifyMembershipRequestDeclined({
    requestId: input.requestId,
    fullName: existing.fullName,
    serviceNumber: existing.serviceNumber,
    remarks,
    actor,
  });
}
