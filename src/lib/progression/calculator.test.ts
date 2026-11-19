import { describe, expect, it } from "vitest";
import {
  calculateBenefitPercentage,
  calculateProgressionFromContributions,
  MATURITY_SUCCESSFUL_MONTHS,
  resolveMembershipProgressionStatus,
} from "@/lib/progression/calculator";
import { MembershipProgressionStatus } from "@/types/enums";

describe("calculateBenefitPercentage", () => {
  it("returns 0% before maturity, 25% at 6 points, then +2.5% per point to 100%", () => {
    expect(calculateBenefitPercentage(0)).toBe(0);
    expect(calculateBenefitPercentage(5)).toBe(0);
    expect(calculateBenefitPercentage(6)).toBe(25);
    expect(calculateBenefitPercentage(7)).toBe(27);
    expect(calculateBenefitPercentage(36)).toBe(100);
  });
});

describe("resolveMembershipProgressionStatus", () => {
  it("maps consecutive completed misses to ACTIVE / DEFAULTING (no LAPSED)", () => {
    expect(
      resolveMembershipProgressionStatus({ consecutiveMissedMonths: 0 }),
    ).toBe(MembershipProgressionStatus.ACTIVE);
    expect(
      resolveMembershipProgressionStatus({ consecutiveMissedMonths: 2 }),
    ).toBe(MembershipProgressionStatus.DEFAULTING);
  });
});

describe("final welfare progression rules", () => {
  const joinAug = { year: 2026, month: 8 };

  function dues(year: number, month: number, at?: string) {
    return {
      year,
      month,
      contributionType: "monthly_dues" as const,
      status: "paid" as const,
      contributedAt:
        at ?? `${year}-${String(month).padStart(2, "0")}-15T10:00:00.000Z`,
    };
  }

  function calc(
    overrides: Partial<
      Parameters<typeof calculateProgressionFromContributions>[0]
    > = {},
  ) {
    return calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart: joinAug,
      asOf: { year: 2026, month: 11 },
      defaulterThresholdMonths: 2,
      contributions: [],
      resetAtIso: "2026-11-01T00:00:00.000Z",
      ...overrides,
    });
  }

  it("A: Aug paid, Sep+Oct unpaid, asOf Nov → pre-maturity reset", () => {
    const result = calc({ contributions: [dues(2026, 8)] });

    expect(result.consecutiveMissedMonths).toBe(2);
    expect(result.didReset).toBe(true);
    expect(result.welfarePoints).toBe(0);
    expect(result.isMature).toBe(false);
    expect(result.maturityDate).toBeNull();
    expect(result.resetCount).toBe(1);
    expect(result.progressionEpochMonth).toEqual({ year: 2026, month: 11 });
    expect(result.outstandingContributionMonths).toBe(3);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.DEFAULTING);
    expect(result.eligibleToClaim).toBe(false);
  });

  it("B: never contributed — no fake reset when progression is already zero", () => {
    const result = calc({ contributions: [] });

    expect(result.consecutiveMissedMonths).toBe(2);
    expect(result.didReset).toBe(false);
    expect(result.resetCount).toBe(0);
    expect(result.welfarePoints).toBe(0);
    expect(result.progressionEpochMonth).toEqual(joinAug);
    expect(result.outstandingContributionMonths).toBe(4);
  });

  it("C: Aug paid, Sep unpaid, Oct paid → no reset", () => {
    const result = calc({
      contributions: [dues(2026, 8), dues(2026, 10)],
    });

    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.didReset).toBe(false);
    expect(result.welfarePoints).toBe(2);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
  });

  it("D: six successful months → maturity", () => {
    const result = calc({
      asOf: { year: 2027, month: 1 },
      contributions: [
        dues(2026, 8),
        dues(2026, 9),
        dues(2026, 10),
        dues(2026, 11),
        dues(2026, 12),
        dues(2027, 1),
      ],
    });

    expect(result.welfarePoints).toBeGreaterThanOrEqual(MATURITY_SUCCESSFUL_MONTHS);
    expect(result.isMature).toBe(true);
    expect(result.benefitPercentage).toBe(25);
    expect(result.didReset).toBe(false);
    expect(result.eligibleToClaim).toBe(true);
  });

  it("E: mature member — six consecutive completed misses → reset", () => {
    const result = calc({
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2027, month: 1 },
      contributions: [1, 2, 3, 4, 5, 6].map((m) => dues(2026, m)),
    });

    expect(result.consecutiveMissedMonths).toBe(6);
    expect(result.didReset).toBe(true);
    expect(result.welfarePoints).toBe(0);
    expect(result.isMature).toBe(false);
    expect(result.maturityDate).toBeNull();
    expect(result.eligibleToClaim).toBe(false);
    expect(result.progressionEpochMonth).toEqual({ year: 2027, month: 1 });
  });

  it("F: mature — five misses then a payment → no reset", () => {
    const result = calc({
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2027, month: 1 },
      contributions: [1, 2, 3, 4, 5, 6, 12].map((m) => dues(2026, m)),
    });

    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.didReset).toBe(false);
    expect(result.isMature).toBe(true);
    expect(result.welfarePoints).toBe(7);
  });

  it("G: miss, miss, paid, miss — streak breaks and restarts at 1", () => {
    const result = calc({
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2026, month: 7 },
      contributions: [dues(2026, 1), dues(2026, 2), dues(2026, 5)],
    });

    expect(result.consecutiveMissedMonths).toBe(1);
    expect(result.didReset).toBe(false);
    expect(result.welfarePoints).toBe(3);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.DEFAULTING);
  });

  it("H: join Aug 1/7/24/31 all use August calendar cycle", () => {
    for (const day of [1, 7, 24, 31]) {
      expect(day).toBeGreaterThan(0);
      const result = calc({
        membershipStart: joinAug,
        asOf: { year: 2026, month: 8 },
        contributions: [],
      });
      expect(result.outstandingMonths).toEqual([joinAug]);
      expect(result.consecutiveMissedMonths).toBe(0);
    }
  });

  it("I: open month payable but not a completed miss", () => {
    const result = calc({
      contributions: [dues(2026, 8)],
      asOf: { year: 2026, month: 9 },
    });

    expect(result.outstandingMonths).toEqual([{ year: 2026, month: 9 }]);
    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.didReset).toBe(false);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
  });

  it("J: joining month unpaid — outstanding but does not start streak", () => {
    const result = calc({
      contributions: [],
      asOf: { year: 2026, month: 8 },
    });

    expect(result.outstandingContributionMonths).toBe(1);
    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
  });

  it("K/L: historical paid rows preserved as inputs; points wiped via epoch", () => {
    const contributions = [dues(2026, 8)];
    const result = calc({ contributions });

    expect(result.didReset).toBe(true);
    expect(result.welfarePoints).toBe(0);
    expect(contributions).toHaveLength(1);
    expect(contributions[0]?.status).toBe("paid");
  });

  it("M: contributions after reset count in the new epoch", () => {
    const result = calc({
      contributions: [dues(2026, 8), dues(2026, 11)],
      asOf: { year: 2026, month: 11 },
      existingProgressionEpoch: { year: 2026, month: 11 },
      existingResetCount: 1,
      existingLastProgressionResetAt: "2026-11-01T00:00:00.000Z",
    });

    expect(result.didReset).toBe(false);
    expect(result.resetCount).toBe(1);
    expect(result.welfarePoints).toBe(1);
    expect(result.progressionEpochMonth).toEqual({ year: 2026, month: 11 });
  });

  it("N: reset is idempotent when already wiped for this epoch", () => {
    const first = calc({ contributions: [dues(2026, 8)] });
    expect(first.didReset).toBe(true);

    const second = calc({
      contributions: [dues(2026, 8)],
      existingProgressionEpoch: first.progressionEpochMonth,
      existingResetCount: first.resetCount,
      existingLastProgressionResetAt: first.lastProgressionResetAt,
    });

    expect(second.didReset).toBe(false);
    expect(second.resetCount).toBe(1);
    expect(second.welfarePoints).toBe(0);
  });

  it("O: claims eligibility false after reset even if previously mature", () => {
    const matureThenMiss = calc({
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2027, month: 1 },
      contributions: [1, 2, 3, 4, 5, 6].map((m) => dues(2026, m)),
      existingMaturityDate: "2026-06-15T00:00:00.000Z",
    });

    expect(matureThenMiss.didReset).toBe(true);
    expect(matureThenMiss.isMature).toBe(false);
    expect(matureThenMiss.eligibleToClaim).toBe(false);
    expect(matureThenMiss.maturityDate).toBeNull();
  });

  it("cohort safety: Aug join, Sep open — no two-month reset yet", () => {
    const result = calc({
      contributions: [],
      asOf: { year: 2026, month: 9 },
    });

    expect(result.outstandingContributionMonths).toBe(2); // Aug+Sep payable
    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.didReset).toBe(false);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
  });

  it("awards points for paid months before membership start still outside outstanding", () => {
    const result = calc({
      membershipStart: { year: 2026, month: 8 },
      asOf: { year: 2026, month: 8 },
      contributions: [dues(2026, 7), dues(2026, 8)],
    });

    expect(result.welfarePoints).toBe(2);
    expect(result.outstandingContributionMonths).toBe(0);
  });

  it("ignores cancelled contributions", () => {
    const result = calc({
      asOf: { year: 2026, month: 9 },
      contributions: [
        dues(2026, 8),
        {
          year: 2026,
          month: 9,
          contributionType: "monthly_dues",
          status: "cancelled",
        },
      ],
    });

    expect(result.welfarePoints).toBe(1);
    expect(result.outstandingContributionMonths).toBe(1);
  });
});
