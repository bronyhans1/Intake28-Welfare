import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeExpectedDuesSummary,
  getExpectedDuesSummary,
} from "@/lib/finance/expected-dues";

const mockGetMonthlyDuesAmount = vi.fn();
const mockGetMonthlyDuesCollectedStats = vi.fn();
const mockCollection = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/system-settings/repository", () => ({
  getMonthlyDuesAmount: () => mockGetMonthlyDuesAmount(),
}));

vi.mock("@/lib/contributions/repository", () => ({
  getMonthlyDuesCollectedStats: (...args: unknown[]) =>
    mockGetMonthlyDuesCollectedStats(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

describe("computeExpectedDuesSummary", () => {
  it("calculates expected dues amounts and collection rate", () => {
    expect(
      computeExpectedDuesSummary({
        activeMembers: 10,
        monthlyDuesAmount: 50,
        collectedAmount: 350,
      }),
    ).toEqual({
      activeMembers: 10,
      monthlyDuesAmount: 50,
      expectedAmount: 500,
      collectedAmount: 350,
      outstandingAmount: 150,
      collectionRate: 70,
    });
  });

  it("rounds collection rate to one decimal place", () => {
    const summary = computeExpectedDuesSummary({
      activeMembers: 3,
      monthlyDuesAmount: 50,
      collectedAmount: 33,
    });

    expect(summary.collectionRate).toBe(22);
  });

  it("handles zero active members", () => {
    expect(
      computeExpectedDuesSummary({
        activeMembers: 0,
        monthlyDuesAmount: 50,
        collectedAmount: 0,
      }),
    ).toEqual({
      activeMembers: 0,
      monthlyDuesAmount: 50,
      expectedAmount: 0,
      collectedAmount: 0,
      outstandingAmount: 0,
      collectionRate: 0,
    });
  });
});

describe("getExpectedDuesSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonthlyDuesAmount.mockResolvedValue(50);
    mockGetMonthlyDuesCollectedStats.mockResolvedValue({
      collectedAmount: 150,
      paidMemberIds: ["m1", "m2", "m3"],
    });
    mockCollection.mockReturnValue({
      get: mockGet,
    });
    mockGet.mockResolvedValue({
      docs: [
        { id: "m1", data: () => ({ status: "active" }) },
        { id: "m2", data: () => ({ status: "active" }) },
        { id: "m3", data: () => ({ status: "suspended" }) },
        { id: "m4", data: () => ({ status: "inactive" }) },
      ],
    });
  });

  it("aggregates active members, monthly dues amount, and monthly dues collected", async () => {
    const summary = await getExpectedDuesSummary({ month: 6, year: 2026 });

    expect(summary).toEqual({
      activeMembers: 2,
      monthlyDuesAmount: 50,
      expectedAmount: 100,
      collectedAmount: 150,
      outstandingAmount: -50,
      collectionRate: 150,
    });
    expect(mockGetMonthlyDuesCollectedStats).toHaveBeenCalledWith({
      month: 6,
      year: 2026,
    });
  });
});
