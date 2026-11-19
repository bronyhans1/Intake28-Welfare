import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { MemberAuditAction } from "@/lib/members/audit";
import { normalizeMemberEmail } from "@/lib/members/email";
import {
  addParentInformationLockDays,
  isParentInformationLocked,
  parentInformationSnapshotFromRecord,
  pickParentCompletionFields,
  validateParentInformationInput,
} from "@/lib/parent-information/validation";
import {
  updateProfileCompletion,
  type ProfileCompletionUser,
} from "@/lib/profile/profile-completion";
import { resolveOverrideReasonText } from "@/lib/validators/parent-information";
import type { CurrentUser } from "@/types/auth";
import type {
  ParentInformationFormInput,
  ParentInformationOverrideEntry,
  ParentInformationOverrideInput,
  ParentInformationValues,
} from "@/types/parent-information";
import type { User } from "@/types/user";
import { randomUUID } from "crypto";

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

async function getMemberRecord(memberId: string): Promise<User | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.USERS).doc(memberId).get();
  if (!doc.exists) return null;
  return mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>);
}

export function buildParentProfileCompletionFields(
  record: Pick<
    User,
    | "motherFullName"
    | "motherStatus"
    | "fatherFullName"
    | "fatherStatus"
  >,
): Pick<
  ProfileCompletionUser,
  "motherFullName" | "motherStatus" | "fatherFullName" | "fatherStatus"
> {
  return pickParentCompletionFields(record);
}

function buildCompletionSnapshot(
  existing: User,
  values: ParentInformationValues,
): ProfileCompletionUser {
  return {
    fullName: existing.fullName,
    phoneNumber: existing.phoneNumber,
    email: normalizeMemberEmail(existing.email),
    dateOfBirth: existing.dateOfBirth,
    rank: existing.rank,
    station: existing.station,
    nextOfKin: existing.nextOfKin ?? null,
    emergencyContact: existing.emergencyContact ?? null,
    profilePhotoUrl: existing.profilePhotoUrl ?? null,
    motherFullName: values.motherFullName,
    motherStatus: values.motherStatus,
    fatherFullName: values.fatherFullName,
    fatherStatus: values.fatherStatus,
  };
}

function toParentValues(record: User): ParentInformationValues | null {
  return parentInformationSnapshotFromRecord(record);
}

export async function saveMemberParentInformation(
  memberId: string,
  input: ParentInformationFormInput,
  actor: CurrentUser,
): Promise<{ lockedUntil: Date }> {
  if (actor.uid !== memberId) {
    throw new Error("You can only update your own Parent Information.");
  }

  const existing = await getMemberRecord(memberId);
  if (!existing) {
    throw new Error("Member not found.");
  }

  if (isParentInformationLocked(existing)) {
    throw new Error(
      "Parent Information is locked. Please contact the Welfare Administrator if a correction is required.",
    );
  }

  const validated = validateParentInformationInput(input);
  if (!validated.success || !validated.values) {
    throw new Error(validated.error ?? "Invalid Parent Information.");
  }

  const now = new Date();
  const lockedUntil = addParentInformationLockDays(now);
  const previous = toParentValues(existing);
  const values = validated.values;
  const db = getAdminDb();

  const payload = sanitizeFirestoreData({
    motherFullName: values.motherFullName,
    motherStatus: values.motherStatus,
    fatherFullName: values.fatherFullName,
    fatherStatus: values.fatherStatus,
    parentInformationCompleted: true,
    parentInformationLastUpdated: Timestamp.fromDate(now),
    parentInformationLockedUntil: Timestamp.fromDate(lockedUntil),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("saveMemberParentInformation", payload);
  await db.collection(COLLECTIONS.USERS).doc(memberId).update(payload);
  await updateProfileCompletion(
    memberId,
    buildCompletionSnapshot(existing, values),
  );

  await createAuditLog({
    action: MemberAuditAction.PARENT_INFORMATION_SAVED,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    changes: {
      motherFullName: {
        before: previous?.motherFullName ?? null,
        after: values.motherFullName,
      },
      motherStatus: {
        before: previous?.motherStatus ?? null,
        after: values.motherStatus,
      },
      fatherFullName: {
        before: previous?.fatherFullName ?? null,
        after: values.fatherFullName,
      },
      fatherStatus: {
        before: previous?.fatherStatus ?? null,
        after: values.fatherStatus,
      },
      parentInformationLockedUntil: {
        before: existing.parentInformationLockedUntil ?? null,
        after: lockedUntil.toISOString(),
      },
    },
    metadata: {
      serviceNumber: existing.serviceNumber,
      fullName: existing.fullName,
      actorName: actor.fullName,
      lockDays: 365,
    },
  });

  return { lockedUntil };
}

export async function overrideMemberParentInformation(
  memberId: string,
  input: ParentInformationOverrideInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getMemberRecord(memberId);
  if (!existing) {
    throw new Error("Member not found.");
  }

  const validated = validateParentInformationInput(input);
  if (!validated.success || !validated.values) {
    throw new Error(validated.error ?? "Invalid Parent Information.");
  }

  if (!input.overrideReason) {
    throw new Error("Reason for override is required.");
  }

  const reasonText = resolveOverrideReasonText({
    overrideReason: input.overrideReason,
    overrideReasonDetail: input.overrideReasonDetail,
  });

  if (!reasonText.trim()) {
    throw new Error("Reason for override is required.");
  }

  const previousComplete = toParentValues(existing);
  const previous = previousComplete ?? {
    motherFullName: existing.motherFullName?.trim() || null,
    motherStatus: existing.motherStatus ?? null,
    fatherFullName: existing.fatherFullName?.trim() || null,
    fatherStatus: existing.fatherStatus ?? null,
  };

  const values = validated.values;
  const now = new Date();
  const stillLocked = isParentInformationLocked(existing, now);
  const lockedUntil =
    stillLocked && existing.parentInformationLockedUntil
      ? existing.parentInformationLockedUntil
      : Timestamp.fromDate(addParentInformationLockDays(now));

  const overrideEntry: ParentInformationOverrideEntry = {
    id: randomUUID(),
    previous,
    next: values,
    overrideReason: reasonText,
    overriddenBy: actor.uid,
    overriddenByName: actor.fullName,
    overriddenAt: now.toISOString(),
  };

  const existingHistory = Array.isArray(existing.parentInformationOverrides)
    ? existing.parentInformationOverrides
    : [];

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    motherFullName: values.motherFullName,
    motherStatus: values.motherStatus,
    fatherFullName: values.fatherFullName,
    fatherStatus: values.fatherStatus,
    parentInformationCompleted: true,
    parentInformationLastUpdated: Timestamp.fromDate(now),
    parentInformationLockedUntil: lockedUntil,
    parentInformationOverrides: [...existingHistory, overrideEntry],
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("overrideMemberParentInformation", payload);
  await db.collection(COLLECTIONS.USERS).doc(memberId).update(payload);
  await updateProfileCompletion(
    memberId,
    buildCompletionSnapshot(existing, values),
  );

  await createAuditLog({
    action: MemberAuditAction.PARENT_INFORMATION_OVERRIDE,
    entityType: "user",
    entityId: memberId,
    ...buildAuditActor(actor),
    changes: {
      motherFullName: {
        before: previous.motherFullName,
        after: values.motherFullName,
      },
      motherStatus: {
        before: previous.motherStatus,
        after: values.motherStatus,
      },
      fatherFullName: {
        before: previous.fatherFullName,
        after: values.fatherFullName,
      },
      fatherStatus: {
        before: previous.fatherStatus,
        after: values.fatherStatus,
      },
      overrideReason: {
        before: null,
        after: reasonText,
      },
    },
    metadata: {
      serviceNumber: existing.serviceNumber,
      fullName: existing.fullName,
      actorName: actor.fullName,
      overrideReason: reasonText,
      previousValues: previous,
      nextValues: values,
    },
  });
}
