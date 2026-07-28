/**
 * Executive Membership Progression insights (Phase 3D / 3F).
 * Aggregates persisted progression records — does not recalculate formulas.
 */

import { COLLECTIONS } from "@/lib/constants";
import { formatMonthYearLabel } from "@/lib/finance/period";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  formatOutstandingMonthsDisplay,
  resolveOutstandingBalance,
} from "@/lib/progression/outstanding-display";
import {
  FULL_BENEFIT_WELFARE_POINTS,
  MATURITY_SUCCESSFUL_MONTHS,
} from "@/lib/progression/calculator";
import { listAllMembershipProgressions } from "@/lib/progression/repository";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import { MembershipProgressionStatus } from "@/types/enums";
import type {
  OutstandingContributionMonth,
  SerializedMembershipProgression,
} from "@/types/membership-progression";

export interface ProgressionMemberRef {
  memberId: string;
  fullName: string;
  serviceNumber: string;
  welfarePoints: number;
  benefitPercentage: number;
  consecutiveContributionMonths: number;
  consecutiveMissedMonths: number;
  outstandingContributionMonths: number;
  outstandingMonths: OutstandingContributionMonth[];
  outstandingMonthLabels: string[];
  outstandingMonthsDisplay: string;
  outstandingAmount: number;
  membershipStatus: string;
  isMature: boolean;
}

export interface ApproachingMaturityMember extends ProgressionMemberRef {
  remainingContributions: number;
  expectedMaturity: string;
}

export interface BenefitDistributionBucket {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface DefaultingRiskBucket {
  id: string;
  label: string;
  count: number;
  members: ProgressionMemberRef[];
}

export interface ProgressionActivityItem {
  id: string;
  label: string;
  memberId: string;
  fullName: string;
  serviceNumber: string;
  detail: string;
  occurredAt: string | null;
}

export interface ExecutiveProgressionInsights {
  /** Progression records available (may be less than user total before backfill). */
  progressionRecords: number;
  health: {
    activeStanding: number;
    defaulting: number;
    lapsed: number;
    mature: number;
    notYetMature: number;
  };
  overview: {
    averageWelfarePoints: number;
    averageBenefitPercentage: number;
    highestWelfarePoints: number;
    membersAtFullBenefit: number;
  };
  benefitDistribution: BenefitDistributionBucket[];
  maturity: {
    alreadyMature: number;
    approachingMaturity: number;
    zeroContributions: number;
  };
  approachingMaturityMembers: ApproachingMaturityMember[];
  defaultingRisk: DefaultingRiskBucket[];
  consistency: {
    longestStreak: number;
    averageStreak: number;
    topMembers: ProgressionMemberRef[];
  };
  recentActivity: ProgressionActivityItem[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function resolveOutstanding(row: SerializedMembershipProgression): {
  count: number;
  months: OutstandingContributionMonth[];
  labels: string[];
} {
  const months = row.outstandingMonths ?? [];
  const count = row.outstandingContributionMonths ?? months.length;
  return {
    count,
    months,
    labels: months.map((period) => formatMonthYearLabel(period)),
  };
}

function toRef(
  row: SerializedMembershipProgression,
  names: Map<string, { fullName: string; serviceNumber: string }>,
  monthlyDuesAmount: number,
): ProgressionMemberRef {
  const identity = names.get(row.memberId);
  const outstanding = resolveOutstanding(row);
  return {
    memberId: row.memberId,
    fullName: identity?.fullName ?? "Unknown member",
    serviceNumber: identity?.serviceNumber ?? "—",
    welfarePoints: row.welfarePoints,
    benefitPercentage: row.benefitPercentage,
    consecutiveContributionMonths: row.consecutiveContributionMonths,
    consecutiveMissedMonths: row.consecutiveMissedMonths,
    outstandingContributionMonths: outstanding.count,
    outstandingMonths: outstanding.months,
    outstandingMonthLabels: outstanding.labels,
    outstandingMonthsDisplay: formatOutstandingMonthsDisplay(outstanding.labels),
    outstandingAmount: resolveOutstandingBalance(
      outstanding.count,
      monthlyDuesAmount,
    ),
    membershipStatus: row.membershipStatus,
    isMature: row.isMature,
  };
}

export function aggregateExecutiveProgressionInsights(
  records: SerializedMembershipProgression[],
  names: Map<string, { fullName: string; serviceNumber: string }>,
  monthlyDuesAmount = 0,
): ExecutiveProgressionInsights {
  const total = records.length;

  let activeStanding = 0;
  let defaulting = 0;
  let lapsed = 0;
  let mature = 0;
  let notYetMature = 0;
  let sumPoints = 0;
  let sumBenefit = 0;
  let highestWelfarePoints = 0;
  let membersAtFullBenefit = 0;
  let approachingMaturity = 0;
  let zeroContributions = 0;
  let sumStreak = 0;
  let longestStreak = 0;

  const benefitBuckets: BenefitDistributionBucket[] = [
    { id: "0_24", label: "0–24%", min: 0, max: 24, count: 0 },
    { id: "25_49", label: "25–49%", min: 25, max: 49, count: 0 },
    { id: "50_74", label: "50–74%", min: 50, max: 74, count: 0 },
    { id: "75_99", label: "75–99%", min: 75, max: 99, count: 0 },
    { id: "100", label: "100%", min: 100, max: 100, count: 0 },
  ];

  const approaching: ApproachingMaturityMember[] = [];
  const outstanding1: ProgressionMemberRef[] = [];
  const defaultingMembers: ProgressionMemberRef[] = [];
  const lapsedMembers: ProgressionMemberRef[] = [];
  const activity: ProgressionActivityItem[] = [];

  for (const row of records) {
    const outstanding = resolveOutstanding(row);
    sumPoints += row.welfarePoints;
    sumBenefit += row.benefitPercentage;
    highestWelfarePoints = Math.max(highestWelfarePoints, row.welfarePoints);
    sumStreak += row.consecutiveContributionMonths;
    longestStreak = Math.max(longestStreak, row.consecutiveContributionMonths);

    if (row.membershipStatus === MembershipProgressionStatus.ACTIVE) {
      activeStanding += 1;
    } else if (row.membershipStatus === MembershipProgressionStatus.DEFAULTING) {
      defaulting += 1;
      defaultingMembers.push(toRef(row, names, monthlyDuesAmount));
    } else if (row.membershipStatus === MembershipProgressionStatus.LAPSED) {
      lapsed += 1;
      lapsedMembers.push(toRef(row, names, monthlyDuesAmount));
    }

    if (row.isMature) {
      mature += 1;
    } else {
      notYetMature += 1;
    }

    if (row.benefitPercentage >= 100 || row.welfarePoints >= FULL_BENEFIT_WELFARE_POINTS) {
      membersAtFullBenefit += 1;
    }

    const benefit = row.benefitPercentage;
    if (benefit >= 100) benefitBuckets[4].count += 1;
    else if (benefit >= 75) benefitBuckets[3].count += 1;
    else if (benefit >= 50) benefitBuckets[2].count += 1;
    else if (benefit >= 25) benefitBuckets[1].count += 1;
    else benefitBuckets[0].count += 1;

    if (
      !row.isMature &&
      (row.welfarePoints === 4 || row.welfarePoints === 5)
    ) {
      approachingMaturity += 1;
      const remaining = MATURITY_SUCCESSFUL_MONTHS - row.welfarePoints;
      approaching.push({
        ...toRef(row, names, monthlyDuesAmount),
        remainingContributions: remaining,
        expectedMaturity: `After ${remaining} more successful contribution${remaining === 1 ? "" : "s"}`,
      });
    }

    if (row.successfulContributionMonths === 0 || row.welfarePoints === 0) {
      zeroContributions += 1;
    }

    if (
      row.membershipStatus === MembershipProgressionStatus.ACTIVE &&
      outstanding.count === 1
    ) {
      outstanding1.push(toRef(row, names, monthlyDuesAmount));
    }

    const identity = names.get(row.memberId);
    const fullName = identity?.fullName ?? "Unknown member";
    const serviceNumber = identity?.serviceNumber ?? "—";
    const outstandingDetail =
      outstanding.labels.length > 0
        ? outstanding.labels.join(", ")
        : `${outstanding.count} outstanding month${outstanding.count === 1 ? "" : "s"}`;

    if (row.isMature && row.maturityDate) {
      activity.push({
        id: `mature-${row.memberId}`,
        label: "Member reached maturity",
        memberId: row.memberId,
        fullName,
        serviceNumber,
        detail: `${row.welfarePoints} Welfare Points · ${row.benefitPercentage}% benefit`,
        occurredAt: row.maturityDate,
      });
    }
    if (row.benefitPercentage >= 100 || row.welfarePoints >= FULL_BENEFIT_WELFARE_POINTS) {
      activity.push({
        id: `full-${row.memberId}`,
        label: "Member reached 100% benefit",
        memberId: row.memberId,
        fullName,
        serviceNumber,
        detail: `${row.welfarePoints} Welfare Points`,
        occurredAt: row.lastCalculatedAt,
      });
    }
    if (row.membershipStatus === MembershipProgressionStatus.DEFAULTING) {
      activity.push({
        id: `defaulting-${row.memberId}`,
        label: "Member became Defaulting",
        memberId: row.memberId,
        fullName,
        serviceNumber,
        detail: outstandingDetail,
        occurredAt: row.lastCalculatedAt,
      });
    }
    if (row.membershipStatus === MembershipProgressionStatus.LAPSED) {
      activity.push({
        id: `lapsed-${row.memberId}`,
        label: "Member became Lapsed",
        memberId: row.memberId,
        fullName,
        serviceNumber,
        detail: outstandingDetail,
        occurredAt: row.lastCalculatedAt,
      });
    }
  }

  approaching.sort((a, b) => b.welfarePoints - a.welfarePoints || a.fullName.localeCompare(b.fullName));

  const topMembers = [...records]
    .sort(
      (a, b) =>
        b.consecutiveContributionMonths - a.consecutiveContributionMonths ||
        b.welfarePoints - a.welfarePoints,
    )
    .slice(0, 5)
    .map((row) => toRef(row, names, monthlyDuesAmount));

  const recentActivity = activity
    .sort((a, b) => {
      const at = a.occurredAt ? Date.parse(a.occurredAt) : 0;
      const bt = b.occurredAt ? Date.parse(b.occurredAt) : 0;
      return bt - at;
    })
    .slice(0, 10);

  return {
    progressionRecords: total,
    health: {
      activeStanding,
      defaulting,
      lapsed,
      mature,
      notYetMature,
    },
    overview: {
      averageWelfarePoints: total ? round1(sumPoints / total) : 0,
      averageBenefitPercentage: total ? round1(sumBenefit / total) : 0,
      highestWelfarePoints,
      membersAtFullBenefit,
    },
    benefitDistribution: benefitBuckets,
    maturity: {
      alreadyMature: mature,
      approachingMaturity,
      zeroContributions,
    },
    approachingMaturityMembers: approaching.slice(0, 20),
    defaultingRisk: [
      {
        id: "outstanding_1",
        label: "1 outstanding contribution month",
        count: outstanding1.length,
        members: outstanding1.slice(0, 8),
      },
      {
        id: "defaulting",
        label: "Currently Defaulting",
        count: defaultingMembers.length,
        members: defaultingMembers.slice(0, 8),
      },
      {
        id: "lapsed",
        label: "Currently Lapsed",
        count: lapsedMembers.length,
        members: lapsedMembers.slice(0, 8),
      },
    ],
    consistency: {
      longestStreak,
      averageStreak: total ? round1(sumStreak / total) : 0,
      topMembers,
    },
    recentActivity,
  };
}

async function loadMemberNameMap(): Promise<
  Map<string, { fullName: string; serviceNumber: string }>
> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.USERS).get();
  const map = new Map<string, { fullName: string; serviceNumber: string }>();

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    map.set(doc.id, {
      fullName: String(data.fullName ?? "Unknown member"),
      serviceNumber: String(data.serviceNumber ?? "—"),
    });
  }

  return map;
}

/**
 * One progressions collection read + one users read for names.
 * All widgets derive from this in-memory aggregation.
 */
export async function getExecutiveProgressionInsights(): Promise<ExecutiveProgressionInsights> {
  const [records, names, monthlyDuesAmount] = await Promise.all([
    listAllMembershipProgressions(),
    loadMemberNameMap(),
    getMonthlyDuesAmount(),
  ]);

  return aggregateExecutiveProgressionInsights(
    records,
    names,
    monthlyDuesAmount,
  );
}
