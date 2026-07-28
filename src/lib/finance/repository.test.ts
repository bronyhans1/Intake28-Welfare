import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFinancialSummary,
  getFinancialSummary,
} from "@/lib/finance/repository";

const mockGetContributionStats = vi.fn();
const mockGetWelfareSupportStats = vi.fn();

vi.mock("@/lib/contributions/repository", () => ({
  getContributionStats: (...args: unknown[]) => mockGetContributionStats(...args),
}));

vi.mock("@/lib/welfare/repository", () => ({
  getWelfareSupportStats: (...args: unknown[]) => mockGetWelfareSupportStats(...args),
}));

describe("computeFinancialSummary", () => {
  it("calculates current balance from contribution and support totals", () => {
    expect(
      computeFinancialSummary({
        totalContributionAmount: 1000,
        totalSupportAmount: 350,
      }),
    ).toEqual({
      totalContributions: 1000,
      totalSupportPaid: 350,
      currentBalance: 650,
    });
  });

  it("handles zero-record scenarios", () => {
    expect(
      computeFinancialSummary({
        totalContributionAmount: 0,
        totalSupportAmount: 0,
      }),
    ).toEqual({
      totalContributions: 0,
      totalSupportPaid: 0,
      currentBalance: 0,
    });
  });

  it("supports negative balance when support exceeds contributions", () => {
    expect(
      computeFinancialSummary({
        totalContributionAmount: 200,
        totalSupportAmount: 500,
      }),
    ).toEqual({
      totalContributions: 200,
      totalSupportPaid: 500,
      currentBalance: -300,
    });
  });
});

describe("getFinancialSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContributionStats.mockResolvedValue({
      totalContributions: 2,
      totalAmountCollected: 150,
      membersContributed: 2,
    });
    mockGetWelfareSupportStats.mockResolvedValue({
      totalRecords: 1,
      totalAmount: 40,
      membersAssisted: 1,
    });
  });

  it("aggregates contribution and welfare repository stats", async () => {
    const summary = await getFinancialSummary();

    expect(summary).toEqual({
      totalContributions: 150,
      totalSupportPaid: 40,
      currentBalance: 110,
    });
    expect(mockGetContributionStats).toHaveBeenCalledWith({});
    expect(mockGetWelfareSupportStats).toHaveBeenCalledWith({});
  });

  it("passes optional filters to both repositories", async () => {
    await getFinancialSummary({ memberId: "m1", month: 6, year: 2026 });

    expect(mockGetContributionStats).toHaveBeenCalledWith({
      memberId: "m1",
      month: 6,
      year: 2026,
    });
    expect(mockGetWelfareSupportStats).toHaveBeenCalledWith({
      memberId: "m1",
      supportMonth: 6,
      supportYear: 2026,
    });
  });

  it("returns zero balance when both repositories have no amounts", async () => {
    mockGetContributionStats.mockResolvedValue({
      totalContributions: 0,
      totalAmountCollected: 0,
      membersContributed: 0,
    });
    mockGetWelfareSupportStats.mockResolvedValue({
      totalRecords: 0,
      totalAmount: 0,
      membersAssisted: 0,
    });

    const summary = await getFinancialSummary();
    expect(summary.currentBalance).toBe(0);
  });
});
