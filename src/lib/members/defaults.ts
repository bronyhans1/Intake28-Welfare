import { PROFILE_COMPLETION_DEFAULTS } from "@/lib/constants/profile-completion";
import { normalizeGender } from "@/lib/utils/gender";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import type { CreateMemberFormInput } from "@/lib/validators/member";

export const NEW_MEMBER_DEFAULTS = {
  status: UserStatus.ACTIVE,
  activationStatus: ActivationStatus.PENDING,
  profileCompleted: PROFILE_COMPLETION_DEFAULTS.profileCompleted,
  profileCompletionPercentage: PROFILE_COMPLETION_DEFAULTS.profileCompletionPercentage,
  otpAttempts: 0,
  activationOtpSentCount: 0,
  lastOtpSentAt: null,
  otpLockedUntil: null,
  activatedAt: null,
  isDefaulter: false,
  consecutiveUnpaidMonths: 0,
  profilePhotoUrl: null,
  profilePhotoPath: null,
  profilePhotoUpdatedAt: null,
  email: null,
} as const;

export function buildNewMemberDocument(
  memberId: string,
  input: Omit<CreateMemberFormInput, "dateOfBirth"> & {
    serviceNumber: string;
    serviceNumberSuffix: string;
    createdBy: string;
    dateOfBirth: Date | null;
  },
) {
  return {
    id: memberId,
    serviceNumber: input.serviceNumber,
    serviceNumberSuffix: input.serviceNumberSuffix,
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber,
    dateOfBirth: input.dateOfBirth,
    gender: normalizeGender(input.gender),
    rank: input.rank?.trim() || null,
    station: input.station?.trim() || null,
    role: input.role,
    nextOfKin: input.nextOfKin?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    createdBy: input.createdBy,
    ...NEW_MEMBER_DEFAULTS,
  };
}

export function isAssignableMemberRole(role: string): role is UserRole {
  return role === UserRole.ADMIN || role === UserRole.TREASURER || role === UserRole.MEMBER;
}

export function isManageableMemberStatus(status: string): status is UserStatus {
  return (
    status === UserStatus.ACTIVE ||
    status === UserStatus.INACTIVE ||
    status === UserStatus.SUSPENDED ||
    status === UserStatus.DEACTIVATED
  );
}
