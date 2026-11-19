import {
  assertMonthsWithinContributionWindow,
  buildPaidMonthlyDuesKeys,
  computeOutstandingContributionMonths,
  resolveContributionStartMonth,
} from "@/lib/contributions/outstanding-months";
import { getContributionMonths } from "@/lib/contributions/repository";
import { estimateProgressionAfterPayingMonths } from "@/lib/contributions/arrears-progression-estimate";
import { calculateProgressionFromContributions } from "@/lib/progression/calculator";
import { monthYearKey, type MonthYear } from "@/lib/finance/period";
import {
  ContributionStatus,
  ContributionType,
  MembershipProgressionStatus,
} from "@/types/enums";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/finance/period", async () => {
  const actual = await vi.importActual<typeof import("@/lib/finance/period")>(
    "@/lib/finance/period",
  );
  return {
    ...actual,
    getCurrentMonthYear: () => ({ month: 12, year: 2026 }),
  };
});

function computeOutstandingMonths(
  membershipStart: MonthYear,
  asOf: MonthYear,
  paid: MonthYear[],
): MonthYear[] {
  const paidKeys = new Set(paid.map((period) => monthYearKey(period)));
  return getContributionMonths(membershipStart, asOf).filter(
    (period) => !paidKeys.has(monthYearKey(period)),
  );
}

describe("resolveContributionStartMonth", () => {
  it("uses createdAt even when joining mid-month", () => {
    expect(
      resolveContributionStartMonth({
        activatedAt: "2026-09-03T10:00:00.000Z",
        createdAt: "2026-08-07T12:00:00.000Z",
      }),
    ).toEqual({ month: 8, year: 2026 });
  });

  it("uses createdAt when activation is missing", () => {
    expect(
      resolveContributionStartMonth({
        activatedAt: null,
        createdAt: "2026-08-07T12:00:00.000Z",
      }),
    ).toEqual({ month: 8, year: 2026 });
  });

  it("does not use a later activatedAt as the membership start", () => {
    expect(
      resolveContributionStartMonth({
        activatedAt: "2026-09-03T15:00:00.000Z",
        createdAt: "2026-08-07T08:00:00.000Z",
      }),
    ).toEqual({ month: 8, year: 2026 });
  });
});

describe("added in August, activated in September", () => {
  const member = {
    createdAt: "2026-08-07T12:00:00.000Z",
    activatedAt: "2026-09-03T10:00:00.000Z",
  };
  const asOf = { month: 9, year: 2026 };

  it("TEST 1: unpaid August is arrears and September is current", () => {
    const start = resolveContributionStartMonth(member);
    expect(start).toEqual({ month: 8, year: 2026 });

    const outstanding = computeOutstandingMonths(start!, asOf, [
      { month: 7, year: 2026 },
    ]);

    expect(outstanding).toEqual([
      { month: 8, year: 2026 },
      { month: 9, year: 2026 },
    ]);
    expect(outstanding.some((item) => item.month === 7 && item.year === 2026)).toBe(
      false,
    );
  });

  it("TEST 2: paid August is not outstanding; unpaid September remains current", () => {
    const start = resolveContributionStartMonth(member);
    const outstanding = computeOutstandingMonths(start!, asOf, [
      { month: 7, year: 2026 },
      { month: 8, year: 2026 },
    ]);

    expect(outstanding).toEqual([{ month: 9, year: 2026 }]);
  });

  it("TEST 3: same-month createdAt and activatedAt does not add extra months", () => {
    const start = resolveContributionStartMonth({
      createdAt: "2026-08-07T12:00:00.000Z",
      activatedAt: "2026-08-20T10:00:00.000Z",
    });
    expect(start).toEqual({ month: 8, year: 2026 });

    const outstanding = computeOutstandingMonths(start!, { month: 8, year: 2026 }, []);
    expect(outstanding).toEqual([{ month: 8, year: 2026 }]);
  });

  it("TEST 4: never-activated members still start from createdAt", () => {
    expect(
      resolveContributionStartMonth({
        createdAt: "2026-08-07T12:00:00.000Z",
        activatedAt: null,
      }),
    ).toEqual({ month: 8, year: 2026 });
  });

  it("computes arrears and current from one paid-dues lookup", () => {
    const membershipStart = resolveContributionStartMonth(member)!;
    const paidKeys = buildPaidMonthlyDuesKeys([
      {
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        month: 8,
        year: 2026,
      },
      {
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
        status: ContributionStatus.PAID,
        month: 9,
        year: 2026,
      },
    ]);

    const result = computeOutstandingContributionMonths({
      membershipStart,
      currentMonth: asOf,
      paidMonthlyDuesKeys: paidKeys,
      monthlyDuesAmount: 50,
    });

    expect(result.arrears).toEqual([]);
    expect(result.current).toMatchObject({
      month: 9,
      year: 2026,
      amount: 50,
      isCurrent: true,
    });
    expect(result.outstanding).toHaveLength(1);
  });

  it("TEST 5: August is within the payment contribution window after later activation", () => {
    const membershipStart = resolveContributionStartMonth(member);
    expect(() =>
      assertMonthsWithinContributionWindow({
        selectedMonths: [{ month: 8, year: 2026 }],
        membershipStart: membershipStart!,
        currentMonth: asOf,
      }),
    ).not.toThrow();
  });

  it("TEST 6: unpaid August is outstanding (grace) and does not force DEFAULTING while Sep is open", () => {
    const membershipStart = resolveContributionStartMonth(member)!;
    const result = calculateProgressionFromContributions({
      memberId: "member-aug",
      membershipStart,
      asOf,
      defaulterThresholdMonths: 2,
      contributions: [
        {
          month: 7,
          year: 2026,
          contributionType: ContributionType.MONTHLY_DUES,
          status: ContributionStatus.PAID,
        },
      ],
    });

    expect(result.outstandingMonths).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
    ]);
    expect(result.outstandingContributionMonths).toBe(2);
    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
    expect(result.didReset).toBe(false);
    expect(result.welfarePoints).toBe(1);
  });

  it("TEST 7: activateUserRecord does not write createdAt", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/activation/repository.ts"),
      "utf8",
    );
    const fnStart = source.indexOf("export async function activateUserRecord");
    const fnEnd = source.indexOf("export async function", fnStart + 1);
    const fnBody = source.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);

    expect(fnBody).toContain("activatedAt: FieldValue.serverTimestamp()");
    expect(fnBody).not.toMatch(/createdAt\s*:/);
  });
});

describe("buildPaidMonthlyDuesKeys", () => {
  it("only indexes paid monthly dues months", () => {
    const keys = buildPaidMonthlyDuesKeys([
      {
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        month: 8,
        year: 2026,
      },
      {
        contributionType: ContributionType.MONTHLY_DUES,
        status: "pending",
        month: 9,
        year: 2026,
      },
      {
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
        status: ContributionStatus.PAID,
        month: 9,
        year: 2026,
      },
    ]);

    expect(keys.has("2026-08")).toBe(true);
    expect(keys.has("2026-09")).toBe(false);
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
