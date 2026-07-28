import type { Timestamp } from "firebase/firestore";
import type { ActivationStatus, Gender, UserRole, UserStatus } from "./enums";
import type {
  ParentInformationOverrideEntry,
  ParentStatus,
} from "./parent-information";

export interface User {
  /** Firebase Auth UID */
  id: string;
  /** Full service number, e.g. IS/13984 — stored uppercase, immutable after activation */
  serviceNumber: string;
  /** Numeric suffix only, e.g. 13984 — used for admin input and duplicate checks */
  serviceNumberSuffix: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  dateOfBirth?: Timestamp | null;
  gender?: Gender | null;
  rank: string | null;
  station: string | null;
  nextOfKin?: string;
  emergencyContact?: string;
  profilePhotoUrl?: string | null;
  /** Firebase Storage object path, e.g. profile-photos/IS13984/profile.jpg */
  profilePhotoPath?: string | null;
  profilePhotoUpdatedAt?: Timestamp | null;
  /** Mother full name — optional until Parent Information is submitted */
  motherFullName?: string | null;
  motherStatus?: ParentStatus | null;
  fatherFullName?: string | null;
  fatherStatus?: ParentStatus | null;
  /** True after a successful Parent Information save or admin override */
  parentInformationCompleted?: boolean;
  parentInformationLastUpdated?: Timestamp | null;
  /** Members cannot edit Parent Information until this timestamp */
  parentInformationLockedUntil?: Timestamp | null;
  /** Append-only admin override history (also mirrored in audit_logs) */
  parentInformationOverrides?: ParentInformationOverrideEntry[];
  /**
   * Denormalized — true only when activationStatus is `activated`
   * AND all required profile fields are complete. Always false while pending.
   */
  profileCompleted: boolean;
  /**
   * Denormalized — 0–100. Always 0 while activationStatus is `pending`,
   * regardless of imported member data.
   */
  profileCompletionPercentage: number;
  role: UserRole;
  status: UserStatus;
  activationStatus: ActivationStatus;
  /** OTP rate-limiting and tracking — server-managed during activation only */
  lastOtpSentAt: Timestamp | null;
  otpAttempts: number;
  otpLockedUntil: Timestamp | null;
  activationOtpSentCount: number;
  /** Password reset OTP tracking — server-managed during forgot-password flow */
  passwordResetOtp?: string | null;
  passwordResetOtpExpiresAt?: Timestamp | null;
  passwordResetOtpAttempts?: number;
  passwordResetRequestedAt?: Timestamp | null;
  passwordResetLockedUntil?: Timestamp | null;
  passwordResetLastOtpSentAt?: Timestamp | null;
  isDefaulter: boolean;
  defaulterSince?: Timestamp | null;
  consecutiveUnpaidMonths: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  activatedAt?: Timestamp | null;
}

/** Plain JSON member record safe for Server → Client Component props */
export type SerializedMember = Omit<
  User,
  | "dateOfBirth"
  | "lastOtpSentAt"
  | "otpLockedUntil"
  | "defaulterSince"
  | "createdAt"
  | "updatedAt"
  | "activatedAt"
  | "profilePhotoUpdatedAt"
  | "parentInformationLastUpdated"
  | "parentInformationLockedUntil"
  | "parentInformationOverrides"
> & {
  dateOfBirth?: string | null;
  lastOtpSentAt: string | null;
  otpLockedUntil: string | null;
  defaulterSince?: string | null;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string | null;
  profilePhotoUpdatedAt?: string | null;
  parentInformationLastUpdated?: string | null;
  parentInformationLockedUntil?: string | null;
  parentInformationOverrides?: ParentInformationOverrideEntry[];
};

/** Denormalized profile progress fields stored on the user document */
export interface ProfileCompletionSnapshot {
  profileCompleted: boolean;
  profileCompletionPercentage: number;
}

/**
 * Dashboard display state derived from activation + profile completion.
 * Phase 2: drives activation prompt vs. progress widget on /dashboard.
 */
export type DashboardProfileState =
  | "pending_activation"
  | "profile_incomplete"
  | "profile_complete";

/** Profile fields evaluated for completion (excludes activation gate) */
export type ProfileCompletionFieldInput = Pick<
  User,
  | "fullName"
  | "phoneNumber"
  | "email"
  | "dateOfBirth"
  | "rank"
  | "station"
  | "nextOfKin"
  | "emergencyContact"
  | "profilePhotoUrl"
  | "motherFullName"
  | "motherStatus"
  | "fatherFullName"
  | "fatherStatus"
>;

/** Full context required for profile completion calculation */
export interface ProfileCompletionContext {
  activationStatus: ActivationStatus;
  fields: ProfileCompletionFieldInput;
}

/** Fields used when admin creates or imports a member (pre-activation) */
export interface CreateMemberInput {
  serviceNumberSuffix: string;
  fullName: string;
  phoneNumber: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  rank?: string | null;
  station?: string | null;
  role: UserRole;
  nextOfKin?: string | null;
  emergencyContact?: string | null;
}

/** Fields an admin may update on a member record */
export interface AdminUpdateMemberInput {
  fullName: string;
  phoneNumber: string;
  dateOfBirth: Date;
  gender?: Gender | null;
  rank: string;
  station: string;
  role: UserRole;
  status: UserStatus;
  nextOfKin?: string;
  emergencyContact?: string;
}

/** Fields a member may update on their own profile */
export interface UpdateMemberProfileInput {
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: Gender | null;
  rank?: string;
  station?: string;
  nextOfKin?: string;
  emergencyContact?: string;
}
