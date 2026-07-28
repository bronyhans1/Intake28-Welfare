/**
 * Pure display builders for My Welfare Journey (Phase 3C).
 * Benefit % / recommendation values must be supplied by Progression + Claims services —
 * this module only maps them into dashboard copy and presentation structures.
 */

import {
  calculateBenefitPercentage,
  FULL_BENEFIT_WELFARE_POINTS,
  MATURITY_SUCCESSFUL_MONTHS,
} from "@/lib/progression/calculator";
import { MembershipProgressionStatus } from "@/types/enums";
import type { MembershipProgressionSummary } from "@/types/membership-progression";
import type {
  WelfareJourneyBadge,
  WelfareJourneyInsight,
  WelfareJourneyNextMilestone,
  WelfareJourneyStatusInfo,
  WelfareJourneyTimelineItem,
} from "@/types/welfare-journey";

export function resolveJourneyBadge(
  welfarePoints: number,
): WelfareJourneyBadge {
  const points = Math.max(0, Math.floor(welfarePoints));

  if (points >= FULL_BENEFIT_WELFARE_POINTS) {
    return {
      level: "platinum",
      label: "Platinum Member",
      emoji: "💎",
      description: "36 Welfare Points — maximum welfare benefit.",
    };
  }
  if (points >= 30) {
    return {
      level: "gold",
      label: "Gold Member",
      emoji: "🥇",
      description: "30–35 Welfare Points — outstanding commitment.",
    };
  }
  if (points >= 18) {
    return {
      level: "silver",
      label: "Silver Member",
      emoji: "🥈",
      description: "18–29 Welfare Points — strong, growing protection.",
    };
  }
  if (points >= MATURITY_SUCCESSFUL_MONTHS) {
    return {
      level: "bronze",
      label: "Bronze Member",
      emoji: "🥉",
      description: "6–17 Welfare Points — eligible to claim welfare benefits.",
    };
  }
  return {
    level: "starter",
    label: "Starter Member",
    emoji: "🌱",
    description: "0–5 Welfare Points — building your welfare foundation.",
  };
}

export function buildJourneyInsight(
  progression: MembershipProgressionSummary,
): WelfareJourneyInsight {
  const points = progression.welfarePoints;
  const remainingToMaturity = Math.max(
    0,
    MATURITY_SUCCESSFUL_MONTHS - points,
  );

  if (progression.membershipStatus === MembershipProgressionStatus.LAPSED) {
    return {
      category: "lapsed",
      title: "Membership has lapsed",
      messages: [
        "Your membership is currently Lapsed due to prolonged missed contributions.",
        "Reinstatement is required before you can submit welfare claims.",
        "Please contact the welfare office to regularize your membership.",
      ],
      tone: "danger",
    };
  }

  if (
    progression.membershipStatus === MembershipProgressionStatus.DEFAULTING
  ) {
    return {
      category: "defaulting",
      title: "Contributions need attention",
      messages: [
        "Your membership is currently Defaulting.",
        "Please regularize your monthly contributions to protect your eligibility and keep your welfare journey on track.",
      ],
      tone: "warning",
    };
  }

  if (points >= FULL_BENEFIT_WELFARE_POINTS) {
    return {
      category: "platinum",
      title: "Maximum welfare benefit reached",
      messages: [
        "Congratulations — you have reached the highest welfare benefit level.",
        "Thank you for your outstanding consistency and commitment to the scheme.",
      ],
      tone: "celebration",
    };
  }

  if (points >= 30) {
    const remaining = FULL_BENEFIT_WELFARE_POINTS - points;
    return {
      category: "gold",
      title: "Outstanding commitment",
      messages: [
        `Your current benefit percentage is ${progression.benefitPercentage}%.`,
        `Only ${remaining} more Welfare Point${remaining === 1 ? "" : "s"} until maximum benefit.`,
      ],
      tone: "success",
    };
  }

  if (points >= 18) {
    return {
      category: "growing",
      title: "Excellent progress",
      messages: [
        `You have ${points} Welfare Points and a ${progression.benefitPercentage}% benefit percentage.`,
        "Keep contributing consistently to move toward maximum benefit.",
      ],
      tone: "success",
    };
  }

  if (points >= MATURITY_SUCCESSFUL_MONTHS) {
    return {
      category: "mature",
      title: "Congratulations — you are eligible to claim",
      messages: [
        `Your current benefit percentage is ${progression.benefitPercentage}%.`,
        "Continue your monthly contributions to grow your welfare protection.",
      ],
      tone: "success",
    };
  }

  return {
    category: "starter",
    title: "You're building your welfare foundation",
    messages: [
      `You have successfully completed ${points} of the required ${MATURITY_SUCCESSFUL_MONTHS} contributions.`,
      remainingToMaturity > 0
        ? `Only ${remainingToMaturity} more successful contribution${remainingToMaturity === 1 ? "" : "s"} to become eligible for welfare claims.`
        : "You are on the verge of membership maturity.",
    ],
    tone: "encouraging",
  };
}

/**
 * Next milestone uses ProgressionEngine benefit formula via calculateBenefitPercentage
 * (imported from the progression module — not reimplemented).
 */
export function buildNextMilestone(
  progression: MembershipProgressionSummary,
): WelfareJourneyNextMilestone {
  const currentPoints = progression.welfarePoints;
  const currentBenefitPercentage = progression.benefitPercentage;

  if (currentPoints >= FULL_BENEFIT_WELFARE_POINTS) {
    return {
      kind: "maximum",
      currentPoints,
      currentBenefitPercentage,
      nextPoints: null,
      nextBenefitPercentage: null,
      remainingContributions: 0,
      headline: "Maximum benefit achieved",
      detail:
        "You have reached 36 Welfare Points and 100% benefit. Keep contributing to stay in good standing.",
    };
  }

  if (currentPoints < MATURITY_SUCCESSFUL_MONTHS) {
    const remaining = MATURITY_SUCCESSFUL_MONTHS - currentPoints;
    const nextPoints = MATURITY_SUCCESSFUL_MONTHS;
    const nextBenefitPercentage = calculateBenefitPercentage(nextPoints);
    return {
      kind: "maturity",
      currentPoints,
      currentBenefitPercentage,
      nextPoints,
      nextBenefitPercentage,
      remainingContributions: remaining,
      headline: "Next milestone: Membership Maturity",
      detail: `Only ${remaining} successful contribution${remaining === 1 ? "" : "s"} remaining to become claim-eligible (${nextBenefitPercentage}% benefit at maturity).`,
    };
  }

  const nextPoints = currentPoints + 1;
  const nextBenefitPercentage = calculateBenefitPercentage(nextPoints);
  return {
    kind: "next_point",
    currentPoints,
    currentBenefitPercentage,
    nextPoints,
    nextBenefitPercentage,
    remainingContributions: 1,
    headline: "Next Welfare Point target",
    detail: `Only 1 successful contribution remaining to reach ${nextPoints} Welfare Points (${nextBenefitPercentage}% benefit).`,
  };
}

export function buildStatusInfo(
  status: MembershipProgressionSummary["membershipStatus"],
): WelfareJourneyStatusInfo {
  if (status === MembershipProgressionStatus.LAPSED) {
    return {
      status,
      title: "Lapsed membership",
      description:
        "Your membership has lapsed after prolonged missed contributions. Reinstatement is required before you can submit welfare claims. Contact the welfare office for guidance.",
      tone: "danger",
    };
  }
  if (status === MembershipProgressionStatus.DEFAULTING) {
    return {
      status,
      title: "Defaulting membership",
      description:
        "Defaulting means recent monthly contributions have been missed. Regularize your payments soon to protect claim eligibility and keep your benefit progression healthy.",
      tone: "warning",
    };
  }
  return {
    status: MembershipProgressionStatus.ACTIVE,
    title: "Active — good standing",
    description:
      "You are in good standing with the welfare scheme. Keep making regular monthly contributions to grow your Welfare Points and benefit percentage.",
    tone: "success",
  };
}

export function buildJourneyTimeline(input: {
  progression: MembershipProgressionSummary;
  memberSince: string | null;
  firstContributionDate: string | null;
}): WelfareJourneyTimelineItem[] {
  const { progression, memberSince, firstContributionDate } = input;
  const points = progression.welfarePoints;
  const benefit = progression.benefitPercentage;

  return [
    {
      id: "joined",
      label: "Joined Welfare Scheme",
      completed: Boolean(memberSince),
      date: memberSince,
    },
    {
      id: "first_contribution",
      label: "First Contribution",
      completed: points >= 1,
      date: firstContributionDate,
    },
    {
      id: "matured",
      label: "Membership Matured",
      completed: progression.isMature,
      date: progression.maturityDate,
    },
    {
      id: "benefit_25",
      label: "Reached 25% Benefit",
      completed: benefit >= 25,
      date: benefit >= 25 ? progression.maturityDate : null,
    },
    {
      id: "benefit_50",
      label: "Reached 50% Benefit",
      completed: benefit >= 50,
      date: null,
    },
    {
      id: "benefit_100",
      label: "Reached Maximum Benefit",
      completed: benefit >= 100 || points >= FULL_BENEFIT_WELFARE_POINTS,
      date: null,
    },
  ];
}

export function getNextIncompleteTimelineItem(
  items: WelfareJourneyTimelineItem[],
): WelfareJourneyTimelineItem | null {
  return items.find((item) => !item.completed) ?? null;
}

/**
 * Longest consecutive paid-month run (informational streak display).
 * Does not affect welfare points or eligibility.
 */
export function computeBestContributionStreak(
  paidMonthKeysSorted: string[],
): number {
  if (paidMonthKeysSorted.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < paidMonthKeysSorted.length; i += 1) {
    const prev = paidMonthKeysSorted[i - 1];
    const curr = paidMonthKeysSorted[i];
    const [py, pm] = prev.split("-").map(Number);
    const [cy, cm] = curr.split("-").map(Number);
    const prevNextMonth = pm === 12 ? { y: py + 1, m: 1 } : { y: py, m: pm + 1 };
    if (cy === prevNextMonth.y && cm === prevNextMonth.m) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}
