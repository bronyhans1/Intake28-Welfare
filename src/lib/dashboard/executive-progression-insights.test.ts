import { describe, expect, it } from "vitest";
import { aggregateExecutiveProgressionInsights } from "@/lib/dashboard/executive-progression-insights";
import { MembershipProgressionStatus } from "@/types/enums";
import type { SerializedMembershipProgression } from "@/types/membership-progression";

function row(
  overrides: Partial<SerializedMembershipProgression> & { memberId: string },
): SerializedMembershipProgression {
  return {
    welfarePoints: 0,
    benefitPercentage: 0,
    successfulContributionMonths: 0,
    consecutiveContributionMonths: 0,
    consecutiveMissedMonths: 0,
    outstandingContributionMonths: 0,
    outstandingMonths: [],
    isMature: false,
    eligibleToClaim: false,
    membershipStatus: MembershipProgressionStatus.ACTIVE,
    maturityDate: null,
    lastSuccessfulContributionDate: null,
    lastCalculatedAt: "2026-07-26T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateExecutiveProgressionInsights", () => {
  it("aggregates health, distribution, maturity, and risk from persisted records", () => {
    const names = new Map([
      ["a", { fullName: "Ada", serviceNumber: "SN1" }],
      ["b", { fullName: "Ben", serviceNumber: "SN2" }],
      ["c", { fullName: "Cara", serviceNumber: "SN3" }],
      ["d", { fullName: "Dan", serviceNumber: "SN4" }],
    ]);

    const result = aggregateExecutiveProgressionInsights(
      [
        row({
          memberId: "a",
          welfarePoints: 36,
          benefitPercentage: 100,
          successfulContributionMonths: 36,
          consecutiveContributionMonths: 18,
          isMature: true,
          eligibleToClaim: true,
        }),
        row({
          memberId: "b",
          welfarePoints: 5,
          benefitPercentage: 0,
          successfulContributionMonths: 5,
          consecutiveContributionMonths: 5,
        }),
        row({
          memberId: "c",
          welfarePoints: 8,
          benefitPercentage: 30,
          successfulContributionMonths: 8,
          consecutiveContributionMonths: 0,
          consecutiveMissedMonths: 0,
          outstandingContributionMonths: 2,
          outstandingMonths: [
            { month: 3, year: 2026 },
            { month: 4, year: 2026 },
          ],
          isMature: true,
          membershipStatus: MembershipProgressionStatus.DEFAULTING,
        }),
        row({
          memberId: "d",
          welfarePoints: 0,
          benefitPercentage: 0,
          consecutiveMissedMonths: 6,
          outstandingContributionMonths: 6,
          outstandingMonths: [
            { month: 2, year: 2026 },
            { month: 3, year: 2026 },
            { month: 4, year: 2026 },
            { month: 5, year: 2026 },
            { month: 6, year: 2026 },
            { month: 7, year: 2026 },
          ],
          membershipStatus: MembershipProgressionStatus.LAPSED,
        }),
      ],
      names,
    );

    expect(result.health.activeStanding).toBe(2);
    expect(result.health.defaulting).toBe(1);
    expect(result.health.lapsed).toBe(1);
    expect(result.health.mature).toBe(2);
    expect(result.health.notYetMature).toBe(2);
    expect(result.overview.membersAtFullBenefit).toBe(1);
    expect(result.overview.highestWelfarePoints).toBe(36);
    expect(result.maturity.approachingMaturity).toBe(1);
    expect(result.maturity.zeroContributions).toBe(1);
    expect(result.approachingMaturityMembers[0]?.fullName).toBe("Ben");
    expect(result.approachingMaturityMembers[0]?.remainingContributions).toBe(1);
    expect(result.benefitDistribution.find((b) => b.id === "100")?.count).toBe(1);
    expect(result.consistency.longestStreak).toBe(18);
    expect(result.defaultingRisk.find((b) => b.id === "defaulting")?.count).toBe(1);
  });
});
