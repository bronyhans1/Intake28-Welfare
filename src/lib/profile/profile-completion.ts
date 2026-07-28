/**
 * ADMIN DATA LAYER — Profile completion (field-based only)
 *
 * Architecture rule:
 * - This module is the source of truth for denormalized Firestore fields
 *   (`profileCompletionPercentage`, `profileCompleted`).
 * - It MUST use pure field-based logic only.
 * - Do NOT apply activation rules here — pending members still accumulate
 *   factual profile progress as admins fill in data.
 *
 * UI / member-facing display may gate progress on activation in:
 * @see src/lib/utils/profile-completion.ts
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { safeNumber } from "@/lib/firestore/safe-number";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { isParentRecordComplete } from "@/lib/parent-information/validation";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo";
import { normalizeMemberEmail } from "@/lib/members/email";
import type { ParentStatus } from "@/types/parent-information";
import type { User } from "@/types/user";

export const PROFILE_COMPLETION_REQUIRED_FIELDS = [
  "fullName",
  "phoneNumber",
  "email",
  "dateOfBirth",
  "rank",
  "station",
  "nextOfKin",
  "emergencyContact",
  "profilePhotoUrl",
  "motherInformation",
  "fatherInformation",
] as const;

export type ProfileCompletionRequiredField =
  (typeof PROFILE_COMPLETION_REQUIRED_FIELDS)[number];

export interface ProfileCompletionSummary {
  percentage: number;
  missingFields: ProfileCompletionRequiredField[];
  isComplete: boolean;
}

export type ProfileCompletionUser = {
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  dateOfBirth?: unknown;
  rank: string | null;
  station: string | null;
  nextOfKin?: string | null;
  emergencyContact?: string | null;
  profilePhotoUrl?: string | null;
  motherFullName?: string | null;
  motherStatus?: ParentStatus | null;
  fatherFullName?: string | null;
  fatherStatus?: ParentStatus | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateOfBirthComplete(value: unknown): boolean {
  if (value == null) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (value instanceof Timestamp) return true;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return true;
  }
  return false;
}

function isFieldComplete(
  field: ProfileCompletionRequiredField,
  user: ProfileCompletionUser,
): boolean {
  switch (field) {
    case "fullName":
    case "phoneNumber":
    case "rank":
    case "station":
    case "nextOfKin":
    case "emergencyContact":
      return isNonEmptyString(user[field]);
    case "email":
      return isNonEmptyString(normalizeMemberEmail(user.email));
    case "dateOfBirth":
      return isDateOfBirthComplete(user.dateOfBirth);
    case "profilePhotoUrl":
      return getProfilePhotoUrl(user.profilePhotoUrl) !== null;
    case "motherInformation":
      return isParentRecordComplete(user.motherFullName, user.motherStatus);
    case "fatherInformation":
      return isParentRecordComplete(user.fatherFullName, user.fatherStatus);
    default:
      return false;
  }
}

export function calculateProfileCompletion(
  user: ProfileCompletionUser,
): ProfileCompletionSummary {
  const missingFields = PROFILE_COMPLETION_REQUIRED_FIELDS.filter(
    (field) => !isFieldComplete(field, user),
  );
  const completedCount =
    PROFILE_COMPLETION_REQUIRED_FIELDS.length - missingFields.length;
  const percentage = Math.round(
    (completedCount / PROFILE_COMPLETION_REQUIRED_FIELDS.length) * 100,
  );

  return {
    percentage,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

function mapFirestoreDocToProfileUser(
  data: Record<string, unknown>,
): ProfileCompletionUser {
  return {
    fullName: String(data.fullName ?? ""),
    phoneNumber: String(data.phoneNumber ?? ""),
    email: normalizeMemberEmail(data.email),
    dateOfBirth: data.dateOfBirth as User["dateOfBirth"],
    rank: (data.rank as string | null) ?? null,
    station: (data.station as string | null) ?? null,
    nextOfKin: (data.nextOfKin as string | null | undefined) ?? null,
    emergencyContact:
      (data.emergencyContact as string | null | undefined) ?? null,
    profilePhotoUrl:
      (data.profilePhotoUrl as string | null | undefined) ?? null,
    motherFullName: (data.motherFullName as string | null | undefined) ?? null,
    motherStatus: (data.motherStatus as ParentStatus | null | undefined) ?? null,
    fatherFullName: (data.fatherFullName as string | null | undefined) ?? null,
    fatherStatus: (data.fatherStatus as ParentStatus | null | undefined) ?? null,
  };
}

/**
 * Recalculates and persists profile completion on the user document.
 *
 * Pass `snapshot` when the caller has just written member fields — avoids
 * relying on a follow-up Firestore read that may lag behind the update.
 */
export async function updateProfileCompletion(
  userId: string,
  snapshot?: ProfileCompletionUser,
): Promise<ProfileCompletionSummary> {
  const db = getAdminDb();
  let profileUser = snapshot;

  if (!profileUser) {
    const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();

    if (!doc.exists) {
      throw new Error("User not found.");
    }

    profileUser = mapFirestoreDocToProfileUser(
      doc.data() as Record<string, unknown>,
    );
  }

  const summary = calculateProfileCompletion(profileUser);

  const completionPayload = sanitizeFirestoreData({
    profileCompleted: summary.isComplete,
    profileCompletionPercentage: safeNumber(summary.percentage, 0),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateProfileCompletion", completionPayload);

  await db.collection(COLLECTIONS.USERS).doc(userId).update(completionPayload);

  return summary;
}
