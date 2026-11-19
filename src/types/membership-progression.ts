import type { Timestamp } from "firebase-admin/firestore";
import type { MembershipProgressionStatus } from "@/types/enums";

export interface OutstandingContributionMonth {
  month: number;
  year: number;
}

export interface ProgressionEpochMonth {
  month: number;
  year: number;
}

/**
 * Persisted membership progression — single source of truth per member.
 * Document ID equals memberId.
 */
export interface MembershipProgression {
  memberId: string;
  welfarePoints: number;
  benefitPercentage: number;
  successfulContributionMonths: number;
  consecutiveContributionMonths: number;
  consecutiveMissedMonths: number;
  /** Unpaid monthly-dues months from join through current business month. */
  outstandingContributionMonths: number;
  outstandingMonths: OutstandingContributionMonth[];
  isMature: boolean;
  eligibleToClaim: boolean;
  membershipStatus: MembershipProgressionStatus;
  maturityDate: Timestamp | null;
  lastSuccessfulContributionDate: Timestamp | null;
  /**
   * First contribution month that counts toward the current welfare progression
   * epoch. Null/absent → treat as membership start.
   */
  progressionEpochMonth?: ProgressionEpochMonth | null;
  lastProgressionResetAt?: Timestamp | null;
  resetCount?: number;
  lastCalculatedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SerializedMembershipProgression = Omit<
  MembershipProgression,
  | "maturityDate"
  | "lastSuccessfulContributionDate"
  | "lastProgressionResetAt"
  | "lastCalculatedAt"
  | "createdAt"
  | "updatedAt"
> & {
  maturityDate: string | null;
  lastSuccessfulContributionDate: string | null;
  lastProgressionResetAt?: string | null;
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
};

/** API / client-facing progression summary */
export interface MembershipProgressionSummary {
  memberId: string;
  welfarePoints: number;
  benefitPercentage: number;
  membershipStatus: MembershipProgressionStatus;
  isMature: boolean;
  eligibleToClaim: boolean;
  successfulContributionMonths: number;
  consecutiveContributionMonths: number;
  consecutiveMissedMonths: number;
  outstandingContributionMonths: number;
  outstandingMonths: OutstandingContributionMonth[];
  maturityDate: string | null;
  lastSuccessfulContributionDate: string | null;
  lastCalculatedAt: string;
  progressionEpochMonth?: ProgressionEpochMonth | null;
  resetCount?: number;
  lastProgressionResetAt?: string | null;
}
