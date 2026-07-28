import { getContributionStats } from "@/lib/contributions/repository";
import { getWelfareSupportStats } from "@/lib/welfare/repository";

export interface FinancialSummary {
  /** Sum of paid contribution amounts */
  totalContributions: number;
  /** Sum of welfare support amounts */
  totalSupportPaid: number;
  /** totalContributions - totalSupportPaid */
  currentBalance: number;
}

export interface FinancialSummaryFilters {
  memberId?: string;
  month?: number;
  year?: number;
}

export function computeFinancialSummary(input: {
  totalContributionAmount: number;
  totalSupportAmount: number;
}): FinancialSummary {
  const totalContributions = input.totalContributionAmount;
  const totalSupportPaid = input.totalSupportAmount;

  return {
    totalContributions,
    totalSupportPaid,
    currentBalance: totalContributions - totalSupportPaid,
  };
}

export async function getFinancialSummary(
  filters: FinancialSummaryFilters = {},
): Promise<FinancialSummary> {
  const [contributionStats, supportStats] = await Promise.all([
    getContributionStats({
      memberId: filters.memberId,
      month: filters.month,
      year: filters.year,
    }),
    getWelfareSupportStats({
      memberId: filters.memberId,
      supportMonth: filters.month,
      supportYear: filters.year,
    }),
  ]);

  return computeFinancialSummary({
    totalContributionAmount: contributionStats.totalAmountCollected,
    totalSupportAmount: supportStats.totalAmount,
  });
}
