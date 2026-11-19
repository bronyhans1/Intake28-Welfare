import { describe, expect, it } from "vitest";
import {
  canViewFinanceDashboard,
  formatExpectedDuesDashboardSummary,
  formatFinanceDashboardSummary,
} from "@/lib/finance/dashboard";
import { computeExpectedDuesSummary } from "@/lib/finance/expected-dues";
import { computeFinancialSummary } from "@/lib/finance/repository";
import { UserRole } from "@/types/enums";

describe("canViewFinanceDashboard", () => {
  it("allows admin access", () => {
    expect(canViewFinanceDashboard(UserRole.ADMIN)).toBe(true);
  });

  it("allows treasurer access", () => {
    expect(canViewFinanceDashboard(UserRole.TREASURER)).toBe(true);
  });

  it("denies member access", () => {
    expect(canViewFinanceDashboard(UserRole.MEMBER)).toBe(false);
  });
});

describe("formatFinanceDashboardSummary", () => {
  it("formats financial summary values for dashboard cards", () => {
    const summary = computeFinancialSummary({
      totalContributionAmount: 1250.5,
      totalSupportAmount: 400,
    });

    const formatted = formatFinanceDashboardSummary(summary, {
      totalContributions: 8,
      totalAmountCollected: 1250.5,
      membersContributed: 6,
    });

    expect(formatted).toEqual({
      currentBalance: "GHS 850.50",
      totalContributionsCollected: "GHS 1,250.50",
      totalWelfareSupportPaid: "GHS 400.00",
      membersContributed: 6,
    });
  });

  it("formats zero and negative balances", () => {
    const zeroSummary = computeFinancialSummary({
      totalContributionAmount: 0,
      totalSupportAmount: 0,
    });

    expect(formatFinanceDashboardSummary(zeroSummary, {
      totalContributions: 0,
      totalAmountCollected: 0,
      membersContributed: 0,
    }).currentBalance).toBe("GHS 0.00");

    const negativeSummary = computeFinancialSummary({
      totalContributionAmount: 200,
      totalSupportAmount: 500,
    });

    expect(formatFinanceDashboardSummary(negativeSummary, {
      totalContributions: 2,
      totalAmountCollected: 200,
      membersContributed: 2,
    }).currentBalance).toBe("GHS -300.00");
  });
});

describe("formatExpectedDuesDashboardSummary", () => {
  it("formats expected dues values for finance dashboard cards", () => {
    const formatted = formatExpectedDuesDashboardSummary(
      computeExpectedDuesSummary({
        activeMembers: 10,
        monthlyDuesAmount: 50,
        collectedAmount: 350,
      }),
    );

    expect(formatted).toEqual({
      expectedThisMonth: "GHS 500.00",
      collectedThisMonth: "GHS 350.00",
      outstandingThisMonth: "GHS 150.00",
      collectionRate: "70.0%",
    });
  });
});

describe("current balance calculation", () => {
  it("equals total contributions minus total welfare support", () => {
    const summary = computeFinancialSummary({
      totalContributionAmount: 3000,
      totalSupportAmount: 1750.25,
    });

    expect(summary.currentBalance).toBe(1249.75);
    expect(summary.totalContributions - summary.totalSupportPaid).toBe(
      summary.currentBalance,
    );
  });
});
