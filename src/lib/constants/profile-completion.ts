/**
 * Profile completion field definitions and defaults.
 * Calculation logic lives in src/lib/utils/profile-completion.ts
 *
 * Business rule: completion only applies when activationStatus = "activated".
 */

export const PROFILE_COMPLETION_FIELDS = [
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

export type ProfileCompletionField =
  (typeof PROFILE_COMPLETION_FIELDS)[number];

export const PROFILE_COMPLETION_FIELD_LABELS: Record<
  ProfileCompletionField,
  string
> = {
  fullName: "Full Name",
  phoneNumber: "Phone Number",
  email: "Email",
  dateOfBirth: "Date of Birth",
  rank: "Rank",
  station: "Station",
  nextOfKin: "Beneficiary / Next of Kin",
  emergencyContact: "Emergency Contact",
  profilePhotoUrl: "Profile Photo",
  motherInformation: "Mother Information",
  fatherInformation: "Father Information",
};

/** Forced values while activationStatus is "pending" */
export const PROFILE_COMPLETION_DEFAULTS = {
  profileCompleted: false,
  profileCompletionPercentage: 0,
} as const;

export const PROFILE_COMPLETION_TOTAL_FIELDS =
  PROFILE_COMPLETION_FIELDS.length;
