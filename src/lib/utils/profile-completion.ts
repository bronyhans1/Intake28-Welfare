import {
  PROFILE_COMPLETION_DEFAULTS,
  PROFILE_COMPLETION_FIELD_LABELS,
  PROFILE_COMPLETION_FIELDS,
  PROFILE_COMPLETION_TOTAL_FIELDS,
  type ProfileCompletionField,
} from "@/lib/constants/profile-completion";
import { getProfilePhotoUrl } from "@/lib/storage/profile-photo";
import { normalizeMemberEmail } from "@/lib/members/email";
import { isParentRecordComplete } from "@/lib/parent-information/validation";
import { ActivationStatus } from "@/types/enums";
import type {
  DashboardProfileState,
  ProfileCompletionContext,
  ProfileCompletionFieldInput,
  ProfileCompletionSnapshot,
  User,
} from "@/types/user";

/**
 * UI / MEMBER-FACING — Profile completion display logic
 *
 * Architecture rule:
 * - This module MAY apply activation rules for dashboards, widgets, and
 *   member-visible progress (e.g. force 0% while activation is pending).
 * - Do NOT use this module to persist denormalized Firestore completion fields.
 * - Admin data writes must use src/lib/profile/profile-completion.ts instead.
 */

export interface ProfileCompletionFieldStatus {
  field: ProfileCompletionField;
  label: string;
  /** Whether the field currently has a value (factual, independent of activation) */
  hasValue: boolean;
  /** Whether the field counts toward progress (false while activation is pending) */
  countsTowardProgress: boolean;
}

export interface ProfileCompletionResult extends ProfileCompletionSnapshot {
  /** False while activationStatus is "pending" — dashboard must not show progress */
  isEligible: boolean;
  activationStatus: ActivationStatus;
  completedFields: ProfileCompletionField[];
  missingFields: ProfileCompletionField[];
  completedCount: number;
  totalFields: number;
  fieldStatuses: ProfileCompletionFieldStatus[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateOfBirthComplete(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string" && value.trim()) {
    return !Number.isNaN(Date.parse(value));
  }
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return true;
  }
  return false;
}

function isFieldComplete(
  field: ProfileCompletionField,
  fields: ProfileCompletionFieldInput,
): boolean {
  switch (field) {
    case "fullName":
    case "phoneNumber":
    case "rank":
    case "station":
    case "nextOfKin":
    case "emergencyContact":
      return isNonEmptyString(fields[field]);
    case "email":
      return isNonEmptyString(normalizeMemberEmail(fields.email));
    case "dateOfBirth":
      return isDateOfBirthComplete(fields.dateOfBirth);
    case "profilePhotoUrl":
      return getProfilePhotoUrl(fields.profilePhotoUrl) !== null;
    case "motherInformation":
      return isParentRecordComplete(fields.motherFullName, fields.motherStatus);
    case "fatherInformation":
      return isParentRecordComplete(fields.fatherFullName, fields.fatherStatus);
    default:
      return false;
  }
}

/** Profile completion only applies after account activation */
export function isProfileCompletionEligible(
  activationStatus: ActivationStatus,
): boolean {
  return activationStatus === ActivationStatus.ACTIVATED;
}

/** Default snapshot — used for pending users and new documents */
export function getDefaultProfileCompletionSnapshot(): ProfileCompletionSnapshot {
  return { ...PROFILE_COMPLETION_DEFAULTS };
}

function buildFieldStatuses(
  fields: ProfileCompletionFieldInput,
  isEligible: boolean,
): ProfileCompletionFieldStatus[] {
  return PROFILE_COMPLETION_FIELDS.map((field) => {
    const hasValue = isFieldComplete(field, fields);
    return {
      field,
      label: PROFILE_COMPLETION_FIELD_LABELS[field],
      hasValue,
      countsTowardProgress: isEligible && hasValue,
    };
  });
}

function buildIneligibleResult(
  context: ProfileCompletionContext,
): ProfileCompletionResult {
  const fieldStatuses = buildFieldStatuses(context.fields, false);

  return {
    ...PROFILE_COMPLETION_DEFAULTS,
    isEligible: false,
    activationStatus: context.activationStatus,
    completedFields: [],
    missingFields: [...PROFILE_COMPLETION_FIELDS],
    completedCount: 0,
    totalFields: PROFILE_COMPLETION_TOTAL_FIELDS,
    fieldStatuses,
  };
}

/**
 * Evaluates required profile fields with activation gate applied.
 *
 * Rules:
 * - activationStatus = "pending" → always 0% / not completed (imported data ignored)
 * - activationStatus = "activated" → equal-weight calculation across required fields
 */
export function calculateProfileCompletion(
  context: ProfileCompletionContext,
): ProfileCompletionResult {
  if (!isProfileCompletionEligible(context.activationStatus)) {
    return buildIneligibleResult(context);
  }

  const fieldStatuses = buildFieldStatuses(context.fields, true);
  const completedFields = fieldStatuses
    .filter((s) => s.hasValue)
    .map((s) => s.field);
  const missingFields = fieldStatuses
    .filter((s) => !s.hasValue)
    .map((s) => s.field);
  const completedCount = completedFields.length;
  const profileCompletionPercentage = Math.round(
    (completedCount / PROFILE_COMPLETION_TOTAL_FIELDS) * 100,
  );
  const profileCompleted = profileCompletionPercentage === 100;

  return {
    profileCompleted,
    profileCompletionPercentage,
    isEligible: true,
    activationStatus: context.activationStatus,
    completedFields,
    missingFields,
    completedCount,
    totalFields: PROFILE_COMPLETION_TOTAL_FIELDS,
    fieldStatuses,
  };
}

/**
 * Returns denormalized fields to persist on the user document.
 * Call server-side on profile writes and on activation completion.
 */
export function deriveProfileCompletionSnapshot(
  context: ProfileCompletionContext,
): ProfileCompletionSnapshot {
  const result = calculateProfileCompletion(context);
  return {
    profileCompleted: result.profileCompleted,
    profileCompletionPercentage: result.profileCompletionPercentage,
  };
}

export type ProfileCompletionSource = Pick<User, "activationStatus"> & {
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
  motherStatus?: User["motherStatus"];
  fatherFullName?: string | null;
  fatherStatus?: User["fatherStatus"];
};

/** Builds calculation context from a user or serialized member document */
export function toProfileCompletionContext(
  user: ProfileCompletionSource,
): ProfileCompletionContext {
  return {
    activationStatus: user.activationStatus,
    fields: {
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      email: user.email ?? null,
      dateOfBirth: user.dateOfBirth as ProfileCompletionFieldInput["dateOfBirth"],
      rank: user.rank,
      station: user.station,
      nextOfKin: user.nextOfKin ?? undefined,
      emergencyContact: user.emergencyContact ?? undefined,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      motherFullName: user.motherFullName ?? null,
      motherStatus: user.motherStatus ?? null,
      fatherFullName: user.fatherFullName ?? null,
      fatherStatus: user.fatherStatus ?? null,
    },
  };
}

/**
 * Resolves dashboard display state for Phase 2 UI.
 * - pending_activation → show activation prompt
 * - profile_incomplete → show progress widget
 * - profile_complete → show completed state
 */
export function resolveDashboardProfileState(
  user: Pick<User, "activationStatus" | "profileCompleted">,
): DashboardProfileState {
  if (!isProfileCompletionEligible(user.activationStatus)) {
    return "pending_activation";
  }
  if (user.profileCompleted) {
    return "profile_complete";
  }
  return "profile_incomplete";
}
