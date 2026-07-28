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
    expect(calculateBenefitPercentage(1)).toBe(0);
    expect(calculateBenefitPercentage(5)).toBe(0);
    expect(calculateBenefitPercentage(6)).toBe(25);
    expect(calculateBenefitPercentage(7)).toBe(27);
    expect(calculateBenefitPercentage(8)).toBe(30);
    expect(calculateBenefitPercentage(18)).toBe(55);
    expect(calculateBenefitPercentage(36)).toBe(100);
    expect(calculateBenefitPercentage(40)).toBe(100);
    expect(calculateBenefitPercentage(-5)).toBe(0);
  });
});

describe("resolveMembershipProgressionStatus", () => {
  it("maps outstanding contribution months using constitutional thresholds", () => {
    expect(
      resolveMembershipProgressionStatus({
        outstandingContributionMonths: 0,
        defaulterThresholdMonths: 2,
        lapsedThresholdMonths: 6,
      }),
    ).toBe(MembershipProgressionStatus.ACTIVE);

    expect(
      resolveMembershipProgressionStatus({
        outstandingContributionMonths: 1,
        defaulterThresholdMonths: 2,
        lapsedThresholdMonths: 6,
      }),
    ).toBe(MembershipProgressionStatus.ACTIVE);

    expect(
      resolveMembershipProgressionStatus({
        outstandingContributionMonths: 2,
        defaulterThresholdMonths: 2,
        lapsedThresholdMonths: 6,
      }),
    ).toBe(MembershipProgressionStatus.DEFAULTING);

    expect(
      resolveMembershipProgressionStatus({
        outstandingContributionMonths: 6,
        defaulterThresholdMonths: 2,
        lapsedThresholdMonths: 6,
      }),
    ).toBe(MembershipProgressionStatus.LAPSED);
  });
});

describe("calculateProgressionFromContributions", () => {
  const membershipStart = { year: 2026, month: 1 };
  const asOf = { year: 2026, month: 7 };

  function dues(year: number, month: number, at?: string) {
    return {
      year,
      month,
      contributionType: "monthly_dues",
      status: "paid",
      contributedAt: at ?? `2026-${String(month).padStart(2, "0")}-15T10:00:00.000Z`,
    };
  }

  it("awards one welfare point per unique paid monthly-dues month", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart,
      asOf,
      defaulterThresholdMonths: 2,
      contributions: [
        dues(2026, 1),
        dues(2026, 2),
        dues(2026, 2),
        dues(2026, 3),
        {
          year: 2026,
          month: 4,
          contributionType: "special_contribution",
          status: "paid",
        },
      ],
    });

    expect(result.welfarePoints).toBe(3);
    expect(result.successfulContributionMonths).toBe(3);
    expect(result.benefitPercentage).toBe(0);
    expect(result.isMature).toBe(false);
    expect(result.eligibleToClaim).toBe(false);
    expect(result.outstandingContributionMonths).toBe(4);
  });

  it("marks mature and eligible when 6+ successful months and ACTIVE", () => {
    const contributions = [1, 2, 3, 4, 5, 6, 7].map((month) =>
      dues(2026, month),
    );

    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart,
      asOf,
      defaulterThresholdMonths: 2,
      contributions,
    });

    expect(result.successfulContributionMonths).toBeGreaterThanOrEqual(
      MATURITY_SUCCESSFUL_MONTHS,
    );
    expect(result.isMature).toBe(true);
    expect(result.benefitPercentage).toBe(27);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
    expect(result.eligibleToClaim).toBe(true);
    expect(result.outstandingContributionMonths).toBe(0);
    expect(result.consecutiveContributionMonths).toBe(7);
  });

  it("sets DEFAULTING from outstanding months even when a later month is paid", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2026, month: 5 },
      defaulterThresholdMonths: 2,
      contributions: [dues(2026, 1), dues(2026, 2), dues(2026, 5)],
    });

    expect(result.outstandingMonths).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    ]);
    expect(result.outstandingContributionMonths).toBe(2);
    expect(result.consecutiveMissedMonths).toBe(0);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.DEFAULTING);
    expect(result.eligibleToClaim).toBe(false);
  });

  it("sets DEFAULTING when trailing unpaid months hit the threshold", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2026, month: 5 },
      defaulterThresholdMonths: 2,
      contributions: [dues(2026, 1), dues(2026, 2), dues(2026, 3)],
    });

    expect(result.outstandingContributionMonths).toBe(2);
    expect(result.consecutiveMissedMonths).toBe(2);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.DEFAULTING);
    expect(result.eligibleToClaim).toBe(false);
  });

  it("returns ACTIVE after all outstanding months are cleared", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart: { year: 2026, month: 1 },
      asOf: { year: 2026, month: 5 },
      defaulterThresholdMonths: 2,
      contributions: [
        dues(2026, 1),
        dues(2026, 2),
        dues(2026, 3),
        dues(2026, 4),
        dues(2026, 5),
      ],
    });

    expect(result.outstandingContributionMonths).toBe(0);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.ACTIVE);
  });

  it("sets LAPSED after prolonged non-payment", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart: { year: 2025, month: 1 },
      asOf: { year: 2026, month: 7 },
      defaulterThresholdMonths: 2,
      lapsedThresholdMonths: 6,
      contributions: [dues(2025, 1)],
    });

    expect(result.outstandingContributionMonths).toBeGreaterThanOrEqual(6);
    expect(result.membershipStatus).toBe(MembershipProgressionStatus.LAPSED);
    expect(result.eligibleToClaim).toBe(false);
  });

  it("ignores cancelled contributions", () => {
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart,
      asOf: { year: 2026, month: 2 },
      defaulterThresholdMonths: 2,
      contributions: [
        dues(2026, 1),
        {
          year: 2026,
          month: 2,
          contributionType: "monthly_dues",
          status: "cancelled",
        },
      ],
    });

    expect(result.welfarePoints).toBe(1);
    expect(result.outstandingContributionMonths).toBe(1);
  });

  it("preserves existing maturity date when already mature", () => {
    const contributions = [1, 2, 3, 4, 5, 6].map((month) => dues(2026, month));
    const result = calculateProgressionFromContributions({
      memberId: "m1",
      membershipStart,
      asOf: { year: 2026, month: 6 },
      defaulterThresholdMonths: 2,
      contributions,
      existingMaturityDate: "2026-06-01T00:00:00.000Z",
    });

    expect(result.maturityDate).toBe("2026-06-01T00:00:00.000Z");
  });
});
