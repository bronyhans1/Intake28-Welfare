import { formatExpectedDuesDashboardSummary } from "@/lib/finance/dashboard";
import { getExpectedDuesSummary } from "@/lib/finance/expected-dues";
import { getFinancialSummary } from "@/lib/finance/repository";
import { formatCurrency } from "@/lib/utils/currency";
import type { ExpectedDuesFilters } from "@/lib/finance/expected-dues";

export interface FinancialSummaryReport {
  currentBalance: string;
  totalContributions: string;
  totalWelfareSupport: string;
  expectedAmount: string;
  collectedAmount: string;
  outstandingAmount: string;
  collectionRate: string;
}

export interface ReportsDashboardSummary {
  currentBalance: string;
  expectedAmount: string;
  collectedAmount: string;
  outstandingAmount: string;
  collectionRate: string;
}

export async function getFinancialSummaryReport(
  filters: ExpectedDuesFilters = {},
): Promise<FinancialSummaryReport> {
  const [financialSummary, expectedDues] = await Promise.all([
    getFinancialSummary(filters),
    getExpectedDuesSummary(filters),
  ]);

  const expectedDuesFormatted = formatExpectedDuesDashboardSummary(expectedDues);

  return {
    currentBalance: formatCurrency(financialSummary.currentBalance),
    totalContributions: formatCurrency(financialSummary.totalContributions),
    totalWelfareSupport: formatCurrency(financialSummary.totalSupportPaid),
    expectedAmount: expectedDuesFormatted.expectedThisMonth,
    collectedAmount: expectedDuesFormatted.collectedThisMonth,
    outstandingAmount: expectedDuesFormatted.outstandingThisMonth,
    collectionRate: expectedDuesFormatted.collectionRate,
  };
}

export async function getReportsDashboardSummary(
  filters: ExpectedDuesFilters = {},
): Promise<ReportsDashboardSummary> {
  const [financialSummary, expectedDues] = await Promise.all([
    getFinancialSummary(filters),
    getExpectedDuesSummary(filters),
  ]);

  const expectedDuesFormatted = formatExpectedDuesDashboardSummary(expectedDues);

  return {
    currentBalance: formatCurrency(financialSummary.currentBalance),
    expectedAmount: expectedDuesFormatted.expectedThisMonth,
    collectedAmount: expectedDuesFormatted.collectedThisMonth,
    outstandingAmount: expectedDuesFormatted.outstandingThisMonth,
    collectionRate: expectedDuesFormatted.collectionRate,
  };
}
