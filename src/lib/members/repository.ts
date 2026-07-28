import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { disableFirebaseAuthAccountIfExists } from "@/lib/activation/complete";
import { sanitizeFirestoreData, normalizeMemberFieldValue, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { normalizeGender } from "@/lib/utils/gender";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { MemberAuditAction, resolveEmailAuditAction, resolveProfilePhotoAuditAction } from "@/lib/members/audit";
import { buildNewMemberDocument } from "@/lib/members/defaults";
import {
  DUPLICATE_EMAIL_ERROR,
  DUPLICATE_PHONE_NUMBER_ERROR,
  DUPLICATE_SERVICE_NUMBER_ERROR,
  findDuplicateEmail,
  findDuplicatePhoneNumber,
  findDuplicateServiceNumber,
  matchesMemberSearch,
} from "@/lib/members/duplicates";
import { normalizeMemberEmail, resolveMemberEmailInput } from "@/lib/members/email";
import {
  emitProfileFieldChangeEvents,
  emitProfilePhotoChangeEvent,
} from "@/lib/notifications/profile-field-events";
import { assertProfilePhotoPathOwnership } from "@/lib/storage/profile-photo";
import { updateProfileCompletion, type ProfileCompletionUser } from "@/lib/profile/profile-completion";
import { pickParentCompletionFields } from "@/lib/parent-information/validation";
import { formatServiceNumber, normalizeServiceNumberSuffix } from "@/lib/utils/service-number";
import type { CreateMemberFormInput, MemberListQuery, UpdateMemberFormInput } from "@/lib/validators/member";
import type { UpdateProfileFormInput, ProfilePhotoUpdateInput } from "@/lib/validators/profile";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { SerializedMember, User } from "@/types/user";
import type { UserRole as UserRoleType } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

function serializeMember(user: User): SerializedMember {
  const { id, ...rest } = user;
  return serializeFirestoreDoc<SerializedMember>(id, rest as Record<string, unknown>);
}

async function fetchAllUsers(): Promise<User[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => mapFirestoreUser(doc.id, doc.data()));
}

async function getMemberRecord(memberId: string): Promise<User | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.USERS).doc(memberId).get();

  if (!doc.exists) {
    return null;
  }

  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

export async function getMemberById(
  memberId: string,
): Promise<SerializedMember | null> {
  const member = await getMemberRecord(memberId);
  return member ? serializeMember(member) : null;
}

export interface MemberListResult {
  members: SerializedMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listMembers(query: MemberListQuery): Promise<MemberListResult> {
  const users = await fetchAllUsers();

  const filtered = users.filter((user) => {
    if (query.role && user.role !== query.role) return false;
    if (query.status && user.status !== query.status) return false;
    if (query.activationStatus && user.activationStatus !== query.activationStatus) {
      return false;
    }
    if (query.search && !matchesMemberSearch(user, query.search)) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const members = filtered
    .slice(start, start + query.pageSize)
    .map(serializeMember);

  return {
    members,
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function findMemberByServiceNumber(
  serviceNumber: string,
): Promise<User | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("serviceNumber", "==", serviceNumber)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data());
}

export async function findMemberByServiceNumberSuffix(
  suffix: string,
): Promise<User | null> {
  const db = getAdminDb();
  const normalized = normalizeServiceNumberSuffix(suffix);
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("serviceNumberSuffix", "==", normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data());
}

export async function findMemberByPhoneNumber(
  phoneNumber: string,
): Promise<User | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("phoneNumber", "==", phoneNumber)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return mapFirestoreUser(doc.id, doc.data());
}

export async function createMember(
  input: CreateMemberFormInput,
  actor: CurrentUser,
): Promise<{ memberId: string }> {
  const serviceNumberSuffix = normalizeServiceNumberSuffix(input.serviceNumberSuffix);
  const serviceNumber = formatServiceNumber(serviceNumberSuffix);
  const users = await fetchAllUsers();

  if (findDuplicateServiceNumber(users, serviceNumber, serviceNumberSuffix)) {
    throw new Error(DUPLICATE_SERVICE_NUMBER_ERROR);
  }

  if (findDuplicatePhoneNumber(users, input.phoneNumber)) {
    throw new Error(DUPLICATE_PHONE_NUMBER_ERROR);
  }

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.USERS).doc();
  const memberId = ref.id;
  const dateOfBirth =
    input.dateOfBirth?.trim() ? new Date(input.dateOfBirth) : null;

  const document = buildNewMemberDocument(memberId, {
    ...input,
    serviceNumber,
    serviceNumberSuffix,
    createdBy: actor.uid,
    dateOfBirth,
  });

  await ref.set(
    sanitizeFirestoreData({
      ...document,
      dateOfBirth: dateOfBirth ? Timestamp.fromDate(dateOfBirth) : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  await createAuditLog({
    action: MemberAuditAction.MEMBER_CREATED,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    metadata: {
      serviceNumber,
      fullName: input.fullName,
      role: input.role,
    },
  });

  const { recalculateMembershipProgression } = await import(
    "@/lib/progression"
  );
  await recalculateMembershipProgression(memberId);

  return { memberId };
}

export async function updateMember(
  memberId: string,
  input: UpdateMemberFormInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getMemberRecord(memberId);

  if (!existing) {
    throw new Error("Member not found.");
  }

  const users = await fetchAllUsers();

  if (findDuplicatePhoneNumber(users, input.phoneNumber, memberId)) {
    throw new Error(DUPLICATE_PHONE_NUMBER_ERROR);
  }

  const db = getAdminDb();
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  const fields: Array<keyof UpdateMemberFormInput> = [
    "fullName",
    "phoneNumber",
    "gender",
    "rank",
    "station",
    "role",
    "status",
    "nextOfKin",
    "emergencyContact",
  ];

  for (const field of fields) {
    const before = normalizeMemberFieldValue(field, existing[field as keyof User]);
    const after = normalizeMemberFieldValue(field, input[field]);
    if (before !== after) {
      changes[field] = { before, after };
    }
  }

  const normalizedGender = normalizeGender(input.gender);

  const profileSnapshot: ProfileCompletionUser = {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber,
    email: normalizeMemberEmail(existing.email),
    dateOfBirth: Timestamp.fromDate(new Date(input.dateOfBirth)),
    rank: input.rank.trim() || null,
    station: input.station.trim() || null,
    nextOfKin: input.nextOfKin?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    profilePhotoUrl: existing.profilePhotoUrl ?? null,
    ...pickParentCompletionFields(existing),
  };

  const memberUpdatePayload = sanitizeFirestoreData({
    fullName: profileSnapshot.fullName,
    phoneNumber: profileSnapshot.phoneNumber,
    dateOfBirth: profileSnapshot.dateOfBirth,
    gender: normalizedGender,
    rank: profileSnapshot.rank,
    station: profileSnapshot.station,
    role: input.role,
    status: input.status,
    nextOfKin: profileSnapshot.nextOfKin,
    emergencyContact: profileSnapshot.emergencyContact,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateMember", memberUpdatePayload);

  await db.collection(COLLECTIONS.USERS).doc(memberId).update(memberUpdatePayload);

  await updateProfileCompletion(memberId, profileSnapshot);

  if (Object.keys(changes).length > 0) {
    const changeKeys = Object.keys(changes);
    const action =
      changeKeys.length === 1 && changes.status
        ? MemberAuditAction.STATUS_CHANGED
        : changeKeys.length === 1 && changes.role
          ? MemberAuditAction.ROLE_CHANGED
          : MemberAuditAction.MEMBER_UPDATED;

    const auditPayload = {
      action,
      entityType: "user",
      entityId: memberId,
      ...buildAuditActor(actor),
      changes,
      metadata: { serviceNumber: existing.serviceNumber },
    };

    warnInvalidFirestorePayload("updateMember:audit", auditPayload);

    await createAuditLog(auditPayload);
  }
}

export async function resetActivation(
  memberId: string,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getMemberRecord(memberId);

  if (!existing) {
    throw new Error("Member not found.");
  }

  const db = getAdminDb();

  const resetPayload = sanitizeFirestoreData({
    activationStatus: ActivationStatus.PENDING,
    profileCompleted: false,
    profileCompletionPercentage: 0,
    lastOtpSentAt: null,
    otpLockedUntil: null,
    activatedAt: null,
    otpAttempts: 0,
    activationOtpSentCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("resetActivation", resetPayload);

  await db.collection(COLLECTIONS.USERS).doc(memberId).update(resetPayload);

  // Keep Auth identity; block sign-in until the member activates again.
  await disableFirebaseAuthAccountIfExists(memberId);

  await createAuditLog({
    action: MemberAuditAction.ACTIVATION_RESET,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    changes: {
      activationStatus: {
        before: existing.activationStatus,
        after: ActivationStatus.PENDING,
      },
      profileCompleted: {
        before: existing.profileCompleted,
        after: false,
      },
      profileCompletionPercentage: {
        before: existing.profileCompletionPercentage,
        after: 0,
      },
    },
    metadata: { serviceNumber: existing.serviceNumber },
  });
}

export async function changeMemberStatus(
  memberId: string,
  status: UserStatus,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getMemberRecord(memberId);

  if (!existing) {
    throw new Error("Member not found.");
  }

  if (existing.status === status) {
    return;
  }

  const db = getAdminDb();

  const statusPayload = sanitizeFirestoreData({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("changeMemberStatus", statusPayload);

  await db.collection(COLLECTIONS.USERS).doc(memberId).update(statusPayload);

  await createAuditLog({
    action: MemberAuditAction.STATUS_CHANGED,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    changes: {
      status: { before: existing.status, after: status },
    },
    metadata: { serviceNumber: existing.serviceNumber },
  });

  // Reinstatement / status change → refresh progression (dues-based status)
  if (status === UserStatus.ACTIVE || existing.status === UserStatus.ACTIVE) {
    const { recalculateMembershipProgression } = await import(
      "@/lib/progression"
    );
    await recalculateMembershipProgression(memberId);
  }
}

function buildProfileCompletionSnapshot(
  existing: User,
  input: UpdateProfileFormInput,
): ProfileCompletionUser {
  const normalizedGender = normalizeGender(input.gender);

  return {
    fullName: existing.fullName,
    phoneNumber: existing.phoneNumber,
    email: resolveMemberEmailInput(input.email),
    dateOfBirth: Timestamp.fromDate(new Date(input.dateOfBirth)),
    rank: input.rank.trim() || null,
    station: input.station.trim() || null,
    nextOfKin: input.nextOfKin?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    profilePhotoUrl: existing.profilePhotoUrl ?? null,
    ...pickParentCompletionFields(existing),
  };
}

export async function updateMemberProfilePhoto(
  memberId: string,
  input: ProfilePhotoUpdateInput,
  actor: CurrentUser,
): Promise<void> {
  if (actor.uid !== memberId) {
    throw new Error("You can only update your own profile photo.");
  }

  assertProfilePhotoPathOwnership(input.profilePhotoPath, actor.serviceNumber);

  const existing = await getMemberRecord(memberId);
  if (!existing) {
    throw new Error("Member not found.");
  }

  const db = getAdminDb();
  const beforePhoto = existing.profilePhotoUrl ?? null;
  const photoAuditAction = resolveProfilePhotoAuditAction(beforePhoto, input.profilePhotoUrl);

  const profileSnapshot: ProfileCompletionUser = {
    fullName: existing.fullName,
    phoneNumber: existing.phoneNumber,
    email: normalizeMemberEmail(existing.email),
    dateOfBirth: existing.dateOfBirth,
    rank: existing.rank,
    station: existing.station,
    nextOfKin: existing.nextOfKin ?? null,
    emergencyContact: existing.emergencyContact ?? null,
    profilePhotoUrl: input.profilePhotoUrl,
    ...pickParentCompletionFields(existing),
  };

  const photoUpdatePayload = sanitizeFirestoreData({
    profilePhotoUrl: input.profilePhotoUrl,
    profilePhotoPath: input.profilePhotoPath,
    profilePhotoUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateMemberProfilePhoto", photoUpdatePayload);
  await db.collection(COLLECTIONS.USERS).doc(memberId).update(photoUpdatePayload);
  await updateProfileCompletion(memberId, profileSnapshot);

  if (photoAuditAction) {
    await createAuditLog({
      action: photoAuditAction,
      entityType: "user",
      entityId: memberId,
      ...buildAuditActor(actor),
      changes: {
        profilePhotoUrl: { before: beforePhoto, after: input.profilePhotoUrl },
      },
      metadata: {
        serviceNumber: existing.serviceNumber,
        fullName: existing.fullName,
        actorName: actor.fullName,
      },
    });

    await emitProfilePhotoChangeEvent(existing, actor, {
      before: beforePhoto,
      after: input.profilePhotoUrl,
      action:
        photoAuditAction === MemberAuditAction.PROFILE_PHOTO_UPLOADED
          ? "uploaded"
          : "updated",
    });
  }
}

export async function removeMemberProfilePhoto(
  memberId: string,
  actor: CurrentUser,
): Promise<void> {
  if (actor.uid !== memberId) {
    throw new Error("You can only remove your own profile photo.");
  }

  const existing = await getMemberRecord(memberId);
  if (!existing) {
    throw new Error("Member not found.");
  }

  const beforePhoto = existing.profilePhotoUrl ?? null;
  if (!beforePhoto) {
    return;
  }

  const db = getAdminDb();
  const profileSnapshot: ProfileCompletionUser = {
    fullName: existing.fullName,
    phoneNumber: existing.phoneNumber,
    email: normalizeMemberEmail(existing.email),
    dateOfBirth: existing.dateOfBirth,
    rank: existing.rank,
    station: existing.station,
    nextOfKin: existing.nextOfKin ?? null,
    emergencyContact: existing.emergencyContact ?? null,
    profilePhotoUrl: null,
    ...pickParentCompletionFields(existing),
  };

  const photoRemovePayload = sanitizeFirestoreData({
    profilePhotoUrl: null,
    profilePhotoPath: null,
    profilePhotoUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("removeMemberProfilePhoto", photoRemovePayload);
  await db.collection(COLLECTIONS.USERS).doc(memberId).update(photoRemovePayload);
  await updateProfileCompletion(memberId, profileSnapshot);

  await createAuditLog({
    action: MemberAuditAction.PROFILE_PHOTO_REMOVED,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    changes: {
      profilePhotoUrl: { before: beforePhoto, after: null },
    },
    metadata: {
      serviceNumber: existing.serviceNumber,
      fullName: existing.fullName,
      actorName: actor.fullName,
    },
  });

  await emitProfilePhotoChangeEvent(existing, actor, {
    before: beforePhoto,
    after: null,
    action: "removed",
  });
}

export async function updateMemberProfile(
  memberId: string,
  input: UpdateProfileFormInput,
  actor: CurrentUser,
): Promise<void> {
  if (actor.uid !== memberId) {
    throw new Error("You can only update your own profile.");
  }

  const existing = await getMemberRecord(memberId);

  if (!existing) {
    throw new Error("Member not found.");
  }

  const users = await fetchAllUsers();

  const normalizedEmail = resolveMemberEmailInput(input.email);
  if (findDuplicateEmail(users, normalizedEmail, memberId)) {
    throw new Error(DUPLICATE_EMAIL_ERROR);
  }

  const db = getAdminDb();
  const normalizedGender = normalizeGender(input.gender);
  const beforeEmail = normalizeMemberEmail(existing.email);
  const emailAuditAction = resolveEmailAuditAction(beforeEmail, normalizedEmail);

  const profileSnapshot = buildProfileCompletionSnapshot(existing, input);

  const profileUpdatePayload = sanitizeFirestoreData({
    email: normalizedEmail,
    dateOfBirth: profileSnapshot.dateOfBirth,
    gender: normalizedGender,
    rank: profileSnapshot.rank,
    station: profileSnapshot.station,
    nextOfKin: profileSnapshot.nextOfKin,
    emergencyContact: profileSnapshot.emergencyContact,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateMemberProfile", profileUpdatePayload);

  await db.collection(COLLECTIONS.USERS).doc(memberId).update(profileUpdatePayload);

  await updateProfileCompletion(memberId, profileSnapshot);
  await emitProfileFieldChangeEvents(existing, input, actor);

  if (emailAuditAction) {
    await createAuditLog({
      action: emailAuditAction,
      entityType: "user",
      entityId: memberId,
      ...buildAuditActor(actor),
      changes: {
        email: { before: beforeEmail, after: normalizedEmail },
      },
      metadata: {
        serviceNumber: existing.serviceNumber,
        fullName: existing.fullName,
        actorName: actor.fullName,
      },
    });
  }
}

export function canManageMembers(role: UserRoleType): boolean {
  return role === UserRole.ADMIN;
}

export function canViewMembers(role: UserRoleType): boolean {
  return role === UserRole.ADMIN || role === UserRole.TREASURER;
}
