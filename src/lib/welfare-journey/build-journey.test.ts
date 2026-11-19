import { describe, expect, it } from "vitest";
import {
  buildJourneyInsight,
  buildNextMilestone,
  computeBestContributionStreak,
  resolveJourneyBadge,
} from "@/lib/welfare-journey/build-journey";
import { MembershipProgressionStatus } from "@/types/enums";
import type { MembershipProgressionSummary } from "@/types/membership-progression";

function summary(
  overrides: Partial<MembershipProgressionSummary>,
): MembershipProgressionSummary {
  return {
    memberId: "m1",
    welfarePoints: 0,
    benefitPercentage: 0,
    membershipStatus: MembershipProgressionStatus.ACTIVE,
    isMature: false,
    eligibleToClaim: false,
    successfulContributionMonths: 0,
    consecutiveContributionMonths: 0,
    consecutiveMissedMonths: 0,
    outstandingContributionMonths: 0,
    outstandingMonths: [],
    maturityDate: null,
    lastSuccessfulContributionDate: null,
    lastCalculatedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveJourneyBadge", () => {
  it("assigns levels by welfare points", () => {
    expect(resolveJourneyBadge(0).level).toBe("starter");
    expect(resolveJourneyBadge(6).level).toBe("bronze");
    expect(resolveJourneyBadge(18).level).toBe("silver");
    expect(resolveJourneyBadge(30).level).toBe("gold");
    expect(resolveJourneyBadge(36).level).toBe("platinum");
  });
});

describe("buildJourneyInsight", () => {
  it("prioritizes lapsed and defaulting statuses", () => {
    expect(
      buildJourneyInsight(
        summary({ membershipStatus: MembershipProgressionStatus.LAPSED }),
      ).category,
    ).toBe("lapsed");
    expect(
      buildJourneyInsight(
        summary({
          welfarePoints: 20,
          membershipStatus: MembershipProgressionStatus.DEFAULTING,
        }),
      ).category,
    ).toBe("defaulting");
  });

  it("maps active members by point bands", () => {
    expect(buildJourneyInsight(summary({ welfarePoints: 4 })).category).toBe(
      "starter",
    );
    expect(
      buildJourneyInsight(
        summary({
          welfarePoints: 8,
          benefitPercentage: 30,
          isMature: true,
          eligibleToClaim: true,
        }),
      ).category,
    ).toBe("mature");
    expect(
      buildJourneyInsight(
        summary({ welfarePoints: 20, benefitPercentage: 60, isMature: true }),
      ).category,
    ).toBe("growing");
  });
});

describe("buildNextMilestone", () => {
  it("targets maturity before 6 points using progression benefit formula", () => {
    const result = buildNextMilestone(summary({ welfarePoints: 4 }));
    expect(result.kind).toBe("maturity");
    expect(result.nextPoints).toBe(6);
    expect(result.nextBenefitPercentage).toBe(25);
    expect(result.remainingContributions).toBe(2);
  });

  it("targets the next welfare point after maturity", () => {
    const result = buildNextMilestone(
      summary({
        welfarePoints: 24,
        benefitPercentage: 70,
        isMature: true,
      }),
    );
    expect(result.kind).toBe("next_point");
    expect(result.nextPoints).toBe(25);
    expect(result.nextBenefitPercentage).toBe(72);
    expect(result.remainingContributions).toBe(1);
  });
});

describe("computeBestContributionStreak", () => {
  it("finds the longest consecutive month run", () => {
    expect(
      computeBestContributionStreak([
        "2025-01",
        "2025-02",
        "2025-03",
        "2025-05",
        "2025-06",
      ]),
    ).toBe(3);
  });
});
