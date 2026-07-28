import {
  calculateRecommendedBenefitAmount,
  resolveClaimCeiling,
} from "@/lib/claims/claim-progression";
import { listMemberClaimDrafts } from "@/lib/claims/claim-repository";
import { listActiveClaimTypesForMembers } from "@/lib/claims/claim-type-repository";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { getFirstName } from "@/lib/utils/greeting";
import {
  FULL_BENEFIT_WELFARE_POINTS,
  MATURITY_SUCCESSFUL_MONTHS,
  getProgressionSummary,
} from "@/lib/progression";
import { formatMonthYearLabel } from "@/lib/finance/period";
import {
  buildJourneyInsight,
  buildJourneyTimeline,
  buildNextMilestone,
  buildStatusInfo,
  computeBestContributionStreak,
  getNextIncompleteTimelineItem,
  resolveJourneyBadge,
} from "@/lib/welfare-journey/build-journey";
import { claimDraftListQuerySchema } from "@/lib/validators/claims";
import { ContributionStatus, ContributionType } from "@/types/enums";
import type { SerializedMember } from "@/types/user";
import type { WelfareJourneyDashboard } from "@/types/welfare-journey";

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function loadPaidMonthlyDuesMonthKeys(memberId: string): Promise<{
  paidMonthKeysSorted: string[];
  firstContributionDate: string | null;
}> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.CONTRIBUTIONS)
    .where("memberId", "==", memberId)
    .get();

  const paidByMonth = new Map<string, string | null>();

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.contributionType !== ContributionType.MONTHLY_DUES) continue;
    if (data.status !== ContributionStatus.PAID) continue;

    const year = Number(data.year);
    const month = Number(data.month);
    if (!Number.isFinite(year) || month < 1 || month > 12) continue;

    const key = monthKey(year, month);
    const createdAt = data.createdAt as { toDate?: () => Date } | undefined;
    const at =
      createdAt && typeof createdAt.toDate === "function"
        ? createdAt.toDate().toISOString()
        : null;

    const existing = paidByMonth.get(key);
    if (!paidByMonth.has(key)) {
      paidByMonth.set(key, at);
    } else if (at && (!existing || at < existing)) {
      paidByMonth.set(key, at);
    }
  }

  const paidMonthKeysSorted = [...paidByMonth.keys()].sort();
  let firstContributionDate: string | null = null;
  for (const key of paidMonthKeysSorted) {
    const at = paidByMonth.get(key) ?? null;
    if (at && (!firstContributionDate || at < firstContributionDate)) {
      firstContributionDate = at;
    }
  }

  return { paidMonthKeysSorted, firstContributionDate };
}

/**
 * Assembles the My Welfare Journey dashboard from Progression + Claims services.
 * Does not recalculate welfare formulas — reads progression and uses Claims
 * recommendation helpers for estimated benefits.
 */
export async function getWelfareJourneyDashboard(
  member: SerializedMember,
): Promise<WelfareJourneyDashboard> {
  const claimsQuery = claimDraftListQuerySchema.parse({ page: 1, pageSize: 5 });

  const [progression, claimTypes, claimsResult, contributionMeta] =
    await Promise.all([
      getProgressionSummary(member.id),
      listActiveClaimTypesForMembers(),
      listMemberClaimDrafts(member.id, claimsQuery),
      loadPaidMonthlyDuesMonthKeys(member.id),
    ]);

  if (!progression) {
    throw new Error("Membership progression could not be loaded.");
  }

  const estimatedBenefits = claimTypes
    .map((type) => {
      try {
        const claimCeiling = resolveClaimCeiling(type);
        const estimatedBenefit = calculateRecommendedBenefitAmount(
          claimCeiling,
          progression.benefitPercentage,
        );
        return {
          claimTypeCode: type.code,
          claimTypeDisplayName: type.displayName,
          claimCeiling,
          estimatedBenefit,
        };
      } catch {
        return null;
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const recentClaims = claimsResult.claims
    .filter((claim) => claim.status !== "draft")
    .slice(0, 5)
    .map((claim) => ({
      id: claim.id,
      claimTypeDisplayName: claim.claimTypeDisplayName,
      submittedAt: claim.submittedAt ?? claim.createdAt ?? null,
      status: claim.status,
      approvedAmount:
        claim.finalAmount ??
        claim.approvedBenefitAmount ??
        claim.approvedAmount ??
        null,
    }));

  const memberSince = member.activatedAt ?? member.createdAt ?? null;
  const timeline = buildJourneyTimeline({
    progression,
    memberSince,
    firstContributionDate: contributionMeta.firstContributionDate,
  });

  const bestMonths = Math.max(
    progression.consecutiveContributionMonths,
    computeBestContributionStreak(contributionMeta.paidMonthKeysSorted),
  );

  return {
    memberId: member.id,
    firstName: getFirstName(member.fullName),
    memberSince,
    progression,
    insight: buildJourneyInsight(progression),
    badge: resolveJourneyBadge(progression.welfarePoints),
    nextMilestone: buildNextMilestone(progression),
    timeline,
    nextTimelineMilestone: getNextIncompleteTimelineItem(timeline),
    statusInfo: buildStatusInfo(progression.membershipStatus),
    estimatedBenefits,
    streak: {
      currentMonths: progression.consecutiveContributionMonths,
      bestMonths,
    },
    recentClaims,
    hasZeroContributions: progression.successfulContributionMonths === 0,
    maxWelfarePoints: FULL_BENEFIT_WELFARE_POINTS,
    maturityPoints: MATURITY_SUCCESSFUL_MONTHS,
    outstandingContributionLabels: (progression.outstandingMonths ?? []).map(
      (period) => formatMonthYearLabel(period),
    ),
  };
}
