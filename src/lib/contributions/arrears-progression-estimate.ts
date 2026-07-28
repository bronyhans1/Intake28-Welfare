import {
  calculateBenefitPercentage,
  calculateProgressionFromContributions,
  type ProgressionCalculationInput,
  type ProgressionCalculationResult,
  type ProgressionContributionInput,
} from "@/lib/progression/calculator";
import type { MonthYear } from "@/lib/finance/period";
import { ContributionStatus, ContributionType } from "@/types/enums";

/**
 * Estimate progression after paying additional unpaid monthly-dues months.
 * Pure helper for member UI — not a second progression engine.
 */
export function estimateProgressionAfterPayingMonths(
  input: ProgressionCalculationInput,
  selectedMonths: MonthYear[],
): {
  before: Pick<
    ProgressionCalculationResult,
    "welfarePoints" | "benefitPercentage" | "membershipStatus"
  >;
  after: Pick<
    ProgressionCalculationResult,
    "welfarePoints" | "benefitPercentage" | "membershipStatus"
  >;
} {
  const before = calculateProgressionFromContributions(input);

  const extras: ProgressionContributionInput[] = selectedMonths.map(
    (period) => ({
      year: period.year,
      month: period.month,
      contributionType: ContributionType.MONTHLY_DUES,
      status: ContributionStatus.PAID,
      contributedAt: new Date().toISOString(),
    }),
  );

  const after = calculateProgressionFromContributions({
    ...input,
    contributions: [...input.contributions, ...extras],
  });

  return {
    before: {
      welfarePoints: before.welfarePoints,
      benefitPercentage: before.benefitPercentage,
      membershipStatus: before.membershipStatus,
    },
    after: {
      welfarePoints: after.welfarePoints,
      benefitPercentage: after.benefitPercentage,
      membershipStatus: after.membershipStatus,
    },
  };
}

export { calculateBenefitPercentage };
