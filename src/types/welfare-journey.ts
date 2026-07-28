import type { MembershipProgressionStatus } from "@/types/enums";
import type { MembershipProgressionSummary } from "@/types/membership-progression";
import type { ClaimStatus } from "@/types/enums";

export type WelfareJourneyBadgeLevel =
  | "starter"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

export type WelfareJourneyInsightCategory =
  | "starter"
  | "mature"
  | "growing"
  | "gold"
  | "platinum"
  | "defaulting"
  | "lapsed";

export interface WelfareJourneyInsight {
  category: WelfareJourneyInsightCategory;
  title: string;
  messages: string[];
  tone: "encouraging" | "success" | "warning" | "danger" | "celebration";
}

export interface WelfareJourneyBadge {
  level: WelfareJourneyBadgeLevel;
  label: string;
  emoji: string;
  description: string;
}

export interface WelfareJourneyNextMilestone {
  kind: "maturity" | "next_point" | "maximum" | "none";
  currentPoints: number;
  currentBenefitPercentage: number;
  nextPoints: number | null;
  nextBenefitPercentage: number | null;
  remainingContributions: number | null;
  headline: string;
  detail: string;
}

export interface WelfareJourneyTimelineItem {
  id: string;
  label: string;
  completed: boolean;
  date: string | null;
}

export interface WelfareJourneyEstimatedBenefit {
  claimTypeCode: string;
  claimTypeDisplayName: string;
  claimCeiling: number;
  estimatedBenefit: number;
}

export interface WelfareJourneyRecentClaim {
  id: string;
  claimTypeDisplayName: string;
  submittedAt: string | null;
  status: ClaimStatus | string;
  approvedAmount: number | null;
}

export interface WelfareJourneyStatusInfo {
  status: MembershipProgressionStatus | string;
  title: string;
  description: string;
  tone: "success" | "warning" | "danger";
}

export interface WelfareJourneyContributionStreak {
  currentMonths: number;
  bestMonths: number;
}

/**
 * Complete read-only payload for My Welfare Journey.
 * All derived display fields are assembled server-side from Progression + Claims.
 */
export interface WelfareJourneyDashboard {
  memberId: string;
  firstName: string;
  memberSince: string | null;
  progression: MembershipProgressionSummary;
  insight: WelfareJourneyInsight;
  badge: WelfareJourneyBadge;
  nextMilestone: WelfareJourneyNextMilestone;
  timeline: WelfareJourneyTimelineItem[];
  nextTimelineMilestone: WelfareJourneyTimelineItem | null;
  statusInfo: WelfareJourneyStatusInfo;
  estimatedBenefits: WelfareJourneyEstimatedBenefit[];
  streak: WelfareJourneyContributionStreak;
  recentClaims: WelfareJourneyRecentClaim[];
  hasZeroContributions: boolean;
  maxWelfarePoints: number;
  maturityPoints: number;
  outstandingContributionLabels: string[];
}
