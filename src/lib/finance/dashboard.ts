import { hasPermission, Permission } from "@/lib/auth/permissions";
import { formatCurrency } from "@/lib/utils/currency";
import type { ContributionStats } from "@/lib/contributions/repository";
import type { UserRole } from "@/types/enums";
import type { FinancialSummary } from "@/lib/finance/repository";
import type { ExpectedDuesSummary } from "@/lib/finance/expected-dues";

export interface FinanceDashboardSummary {
  currentBalance: string;
  totalContributionsCollected: string;
  totalWelfareSupportPaid: string;
  membersContributed: number;
}

export interface ExpectedDuesDashboardSummary {
  expectedThisMonth: string;
  collectedThisMonth: string;
  outstandingThisMonth: string;
  collectionRate: string;
}

export function canViewFinanceDashboard(role: UserRole): boolean {
  return (
    hasPermission(role, Permission.VIEW_CONTRIBUTIONS) &&
    hasPermission(role, Permission.VIEW_WELFARE_SUPPORT)
  );
}

export function formatFinanceDashboardSummary(
  summary: FinancialSummary,
  contributionStats: ContributionStats,
): FinanceDashboardSummary {
  return {
    currentBalance: formatCurrency(summary.currentBalance),
    totalContributionsCollected: formatCurrency(summary.totalContributions),
    totalWelfareSupportPaid: formatCurrency(summary.totalSupportPaid),
    membersContributed: contributionStats.membersContributed,
  };
}

export function formatExpectedDuesDashboardSummary(
  summary: ExpectedDuesSummary,
): ExpectedDuesDashboardSummary {
  return {
    expectedThisMonth: formatCurrency(summary.expectedAmount),
    collectedThisMonth: formatCurrency(summary.collectedAmount),
    outstandingThisMonth: formatCurrency(summary.outstandingAmount),
    collectionRate: `${summary.collectionRate.toFixed(1)}%`,
  };
}
