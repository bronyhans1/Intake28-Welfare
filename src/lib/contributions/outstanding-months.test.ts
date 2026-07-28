import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContributionStatus, ContributionType } from "@/types/enums";
import {
  assertMonthsWithinContributionWindow,
  resolveContributionStartMonth,
} from "@/lib/contributions/outstanding-months";
import { getContributionMonths } from "@/lib/contributions/repository";
import { estimateProgressionAfterPayingMonths } from "@/lib/contributions/arrears-progression-estimate";
import { MembershipProgressionStatus } from "@/types/enums";

vi.mock("@/lib/finance/period", async () => {
  const actual = await vi.importActual<typeof import("@/lib/finance/period")>(
    "@/lib/finance/period",
  );
  return {
    ...actual,
    getCurrentMonthYear: () => ({ month: 12, year: 2026 }),
  };
});

describe("resolveContributionStartMonth", () => {
  it("uses the join month even when joining mid-month", () => {
    expect(
      resolveContributionStartMonth({
        activatedAt: "2026-07-20T15:30:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({ month: 7, year: 2026 });
  });

  it("falls back to createdAt when activation is missing", () => {
    expect(
      resolveContributionStartMonth({
        activatedAt: null,
        createdAt: "2026-11-01T08:00:00.000Z",
      }),
    ).toEqual({ month: 11, year: 2026 });
  });
});

describe("contribution month window", () => {
  it("never includes months before the join month", () => {
    const months = getContributionMonths(
      { month: 7, year: 2026 },
      { month: 12, year: 2026 },
    );

    expect(months[0]).toEqual({ month: 7, year: 2026 });
    expect(months.some((item) => item.month === 6 && item.year === 2026)).toBe(
      false,
    );
  });

  it("rejects selected months before membership start", () => {
    expect(() =>
      assertMonthsWithinContributionWindow({
        selectedMonths: [{ month: 6, year: 2026 }],
        membershipStart: { month: 7, year: 2026 },
        currentMonth: { month: 12, year: 2026 },
      }),
    ).toThrow("before you joined");
  });
});

describe("estimateProgressionAfterPayingMonths", () => {
  it("estimates DEFAULTING to ACTIVE when arrears are cleared", () => {
    const estimate = estimateProgressionAfterPayingMonths(
      {
        memberId: "member-1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 4, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: [
          {
            month: 1,
            year: 2026,
            contributionType: ContributionType.MONTHLY_DUES,
            status: ContributionStatus.PAID,
          },
          {
            month: 2,
            year: 2026,
            contributionType: ContributionType.MONTHLY_DUES,
            status: ContributionStatus.PAID,
          },
        ],
      },
      [
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
      ],
    );

    expect(estimate.before.membershipStatus).toBe(
      MembershipProgressionStatus.DEFAULTING,
    );
    expect(estimate.after.membershipStatus).toBe(
      MembershipProgressionStatus.ACTIVE,
    );
    expect(estimate.after.welfarePoints).toBe(4);
  });

  it("increases benefit percentage after paying multiple months", () => {
    const estimate = estimateProgressionAfterPayingMonths(
      {
        memberId: "member-1",
        membershipStart: { month: 1, year: 2026 },
        asOf: { month: 8, year: 2026 },
        defaulterThresholdMonths: 2,
        contributions: Array.from({ length: 6 }, (_, index) => ({
          month: index + 1,
          year: 2026,
          contributionType: ContributionType.MONTHLY_DUES,
          status: ContributionStatus.PAID,
        })),
      },
      [
        { month: 7, year: 2026 },
        { month: 8, year: 2026 },
      ],
    );

    expect(estimate.before.welfarePoints).toBe(6);
    expect(estimate.after.welfarePoints).toBe(8);
    expect(estimate.after.benefitPercentage).toBeGreaterThan(
      estimate.before.benefitPercentage,
    );
  });
});

describe("duplicate month prevention helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps unique month keys only once", async () => {
    const { normalizeSelectedMonths } = await import(
      "@/lib/payments/monthly-dues-guard"
    );

    expect(
      normalizeSelectedMonths([
        { month: 9, year: 2026 },
        { month: 9, year: 2026 },
        { month: 11, year: 2026 },
      ]),
    ).toEqual([
      { month: 9, year: 2026 },
      { month: 11, year: 2026 },
    ]);
  });
});
