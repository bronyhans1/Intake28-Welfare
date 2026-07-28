/**
 * Membership Claims — Simple Eligibility Engine
 *
 * Answers one question only: can this member submit this claim today?
 * Does NOT approve, reject, score, or calculate benefit amounts.
 */

import { isParentRecordComplete } from "@/lib/parent-information/validation";
import { calculateProfileCompletion } from "@/lib/profile/profile-completion";
import type { ParentStatus } from "@/types/parent-information";
import { UserStatus } from "@/types/enums";

export const ELIGIBILITY_REASONS = {
  MEMBERSHIP_STATUS:
    "Your membership status does not currently allow claim submissions.",
  PARENT_INFORMATION: "Parent Information has not been completed.",
  PROFILE_INCOMPLETE:
    "Your profile must be completed before submitting a claim.",
  WAITING_PERIOD:
    "The required membership period for this claim has not yet been reached.",
  CLAIM_TYPE_MISSING: "Claim type configuration was not found.",
  CLAIM_TYPE_INCOMPLETE:
    "Claim type configuration is incomplete for eligibility checks.",
} as const;

export const ELIGIBILITY_WARNINGS = {
  CONSTITUTION_MISSING:
    "No active Constitution is configured. Administrators should publish one for reference.",
} as const;

export type EligibilityCheckKey =
  | "membershipStatus"
  | "parentInformation"
  | "profileCompletion"
  | "waitingPeriod";

export interface EligibilityCheckResult {
  key: EligibilityCheckKey;
  label: string;
  passed: boolean;
}

export interface MemberEligibilityResult {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  /** Human-readable membership participation status (e.g. Active, Defaulting). */
  memberStatus: string;
  constitutionVersion: string;
  benefitPercentage: number;
  checks: EligibilityCheckResult[];
  waitingPeriodDays: number | null;
  membershipDays: number | null;
}

export interface EligibilityMemberInput {
  status: string;
  isDefaulter?: boolean | null;
  parentInformationCompleted?: boolean | null;
  motherFullName?: string | null;
  motherStatus?: ParentStatus | string | null;
  fatherFullName?: string | null;
  fatherStatus?: ParentStatus | string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  dateOfBirth?: unknown;
  rank?: string | null;
  station?: string | null;
  nextOfKin?: string | null;
  emergencyContact?: string | null;
  profilePhotoUrl?: string | null;
  /** Preferred membership start for waiting-period calculation */
  activatedAt?: unknown;
  createdAt?: unknown;
}

export interface EligibilityClaimTypeInput {
  waitingPeriodDays?: number | null;
  benefitPercentage?: number | null;
}

export interface EligibilityConstitutionInput {
  displayName?: string | null;
  versionNumber?: string | null;
}

export interface EvaluateMemberEligibilityInput {
  member: EligibilityMemberInput;
  claimTypeConfig: EligibilityClaimTypeInput | null;
  constitution: EligibilityConstitutionInput | null;
  /** Defaults to now — injectable for tests */
  asOf?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object") {
    const record = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof record.toDate === "function") {
      try {
        const date = record.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    }
    const seconds =
      typeof record.seconds === "number"
        ? record.seconds
        : typeof record._seconds === "number"
          ? record._seconds
          : null;
    if (seconds != null) {
      return new Date(seconds * 1000);
    }
  }
  return null;
}

function daysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / MS_PER_DAY);
}

/**
 * Resolve display status for eligibility messaging.
 * Defaulting takes precedence when the member is flagged as a defaulter.
 */
export function resolveMemberParticipationStatus(
  member: Pick<EligibilityMemberInput, "status" | "isDefaulter">,
): string {
  if (member.isDefaulter) {
    return "Defaulting";
  }

  switch (member.status) {
    case UserStatus.ACTIVE:
      return "Active";
    case UserStatus.INACTIVE:
      return "Inactive";
    case UserStatus.SUSPENDED:
      return "Suspended";
    case UserStatus.DEACTIVATED:
      return "Deactivated";
    default:
      return String(member.status || "Unknown");
  }
}

function isMembershipEligibleForClaims(
  member: Pick<EligibilityMemberInput, "status" | "isDefaulter">,
): boolean {
  return member.status === UserStatus.ACTIVE && !member.isDefaulter;
}

function isParentInformationComplete(member: EligibilityMemberInput): boolean {
  if (!member.parentInformationCompleted) {
    return false;
  }
  return (
    isParentRecordComplete(member.motherFullName, member.motherStatus) &&
    isParentRecordComplete(member.fatherFullName, member.fatherStatus)
  );
}

function formatConstitutionVersion(
  constitution: EligibilityConstitutionInput | null,
): string {
  if (!constitution) return "";
  const displayName = constitution.displayName?.trim() ?? "";
  const versionNumber = constitution.versionNumber?.trim() ?? "";
  if (displayName && versionNumber) {
    return `${displayName} (${versionNumber})`;
  }
  return displayName || versionNumber || "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Evaluate whether a member may submit a claim of the given type today.
 * Single source of truth for claim eligibility — call this from future
 * submission / review flows instead of duplicating checks.
 */
export function evaluateMemberEligibility(
  input: EvaluateMemberEligibilityInput,
): MemberEligibilityResult {
  const asOf = input.asOf ?? new Date();
  const reasons: string[] = [];
  const warnings: string[] = [];
  const checks: EligibilityCheckResult[] = [];

  const memberStatus = resolveMemberParticipationStatus(input.member);
  const membershipOk = isMembershipEligibleForClaims(input.member);
  checks.push({
    key: "membershipStatus",
    label: "Membership Status",
    passed: membershipOk,
  });
  if (!membershipOk) {
    reasons.push(ELIGIBILITY_REASONS.MEMBERSHIP_STATUS);
  }

  const parentOk = isParentInformationComplete(input.member);
  checks.push({
    key: "parentInformation",
    label: "Parent Information",
    passed: parentOk,
  });
  if (!parentOk) {
    reasons.push(ELIGIBILITY_REASONS.PARENT_INFORMATION);
  }

  const profileSummary = calculateProfileCompletion({
    fullName: String(input.member.fullName ?? ""),
    phoneNumber: String(input.member.phoneNumber ?? ""),
    email: input.member.email,
    dateOfBirth: input.member.dateOfBirth,
    rank: input.member.rank ?? null,
    station: input.member.station ?? null,
    nextOfKin: input.member.nextOfKin,
    emergencyContact: input.member.emergencyContact,
    profilePhotoUrl: input.member.profilePhotoUrl,
    motherFullName: input.member.motherFullName,
    motherStatus: input.member.motherStatus as ParentStatus | null | undefined,
    fatherFullName: input.member.fatherFullName,
    fatherStatus: input.member.fatherStatus as ParentStatus | null | undefined,
  });
  checks.push({
    key: "profileCompletion",
    label: "Profile Complete",
    passed: profileSummary.isComplete,
  });
  if (!profileSummary.isComplete) {
    reasons.push(ELIGIBILITY_REASONS.PROFILE_INCOMPLETE);
  }

  let benefitPercentage = 0;
  let waitingPeriodDays: number | null = null;
  let membershipDays: number | null = null;
  let waitingPeriodOk = false;

  if (!input.claimTypeConfig) {
    reasons.push(ELIGIBILITY_REASONS.CLAIM_TYPE_MISSING);
    checks.push({
      key: "waitingPeriod",
      label: "Waiting Period Satisfied",
      passed: false,
    });
  } else {
    const configuredWaiting = input.claimTypeConfig.waitingPeriodDays;
    const configuredBenefit = input.claimTypeConfig.benefitPercentage;

    if (!isFiniteNumber(configuredWaiting) || !isFiniteNumber(configuredBenefit)) {
      reasons.push(ELIGIBILITY_REASONS.CLAIM_TYPE_INCOMPLETE);
      checks.push({
        key: "waitingPeriod",
        label: "Waiting Period Satisfied",
        passed: false,
      });
    } else {
      waitingPeriodDays = configuredWaiting;
      benefitPercentage = configuredBenefit;

      const membershipStart =
        parseDate(input.member.activatedAt) ?? parseDate(input.member.createdAt);
      if (membershipStart) {
        membershipDays = Math.max(0, daysBetween(membershipStart, asOf));
        waitingPeriodOk = membershipDays >= waitingPeriodDays;
      } else {
        waitingPeriodOk = waitingPeriodDays <= 0;
        membershipDays = waitingPeriodDays <= 0 ? 0 : null;
      }

      checks.push({
        key: "waitingPeriod",
        label: "Waiting Period Satisfied",
        passed: waitingPeriodOk,
      });
      if (!waitingPeriodOk) {
        reasons.push(ELIGIBILITY_REASONS.WAITING_PERIOD);
      }
    }
  }

  const constitutionVersion = formatConstitutionVersion(input.constitution);
  if (!constitutionVersion) {
    warnings.push(ELIGIBILITY_WARNINGS.CONSTITUTION_MISSING);
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    reasons,
    warnings,
    memberStatus,
    constitutionVersion,
    benefitPercentage,
    checks,
    waitingPeriodDays,
    membershipDays,
  };
}
