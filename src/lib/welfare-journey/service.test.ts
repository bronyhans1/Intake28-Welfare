import { describe, expect, it } from "vitest";
import {
  resolveFirstPaidMonthlyDuesContributionDate,
  resolveWelfareJourneyMemberSince,
} from "@/lib/welfare-journey/service";
import { buildJourneyTimeline } from "@/lib/welfare-journey/build-journey";
import { MembershipProgressionStatus } from "@/types/enums";
import type { MembershipProgressionSummary } from "@/types/membership-progression";

function progression(
  overrides: Partial<MembershipProgressionSummary> = {},
): MembershipProgressionSummary {
  return {
    memberId: "m1",
    welfarePoints: 1,
    benefitPercentage: 10,
    membershipStatus: MembershipProgressionStatus.ACTIVE,
    isMature: false,
    eligibleToClaim: false,
    successfulContributionMonths: 1,
    consecutiveContributionMonths: 1,
    consecutiveMissedMonths: 0,
    outstandingContributionMonths: 0,
    outstandingMonths: [],
    maturityDate: null,
    lastSuccessfulContributionDate: null,
    lastCalculatedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveWelfareJourneyMemberSince", () => {
  it("uses createdAt when activatedAt is later", () => {
    expect(
      resolveWelfareJourneyMemberSince({
        createdAt: "2026-08-07T12:00:00.000Z",
        activatedAt: "2026-09-03T10:00:00.000Z",
      }),
    ).toBe("2026-08-07T12:00:00.000Z");
  });

  it("uses createdAt when activatedAt is null", () => {
    expect(
      resolveWelfareJourneyMemberSince({
        createdAt: "2026-08-07T12:00:00.000Z",
        activatedAt: null,
      }),
    ).toBe("2026-08-07T12:00:00.000Z");
  });

  it("does not let activatedAt override createdAt", () => {
    const memberSince = resolveWelfareJourneyMemberSince({
      createdAt: "2026-08-07T12:00:00.000Z",
      activatedAt: "2026-09-03T10:00:00.000Z",
    });

    expect(memberSince).toBe("2026-08-07T12:00:00.000Z");
    expect(memberSince).not.toBe("2026-09-03T10:00:00.000Z");
  });
});

describe("portalActivatedAt vs memberSince", () => {
  it("keeps portal activation distinct from scheme membership start", () => {
    const createdAt = "2026-08-07T12:00:00.000Z";
    const activatedAt = "2026-09-03T10:00:00.000Z";

    const memberSince = resolveWelfareJourneyMemberSince({
      createdAt,
      activatedAt,
    });
    const portalActivatedAt = activatedAt ?? null;

    expect(memberSince).toBe(createdAt);
    expect(portalActivatedAt).toBe(activatedAt);
    expect(portalActivatedAt).not.toBe(memberSince);
  });

  it("treats missing activatedAt as not activated", () => {
    const portalActivatedAt = null;
    expect(portalActivatedAt).toBeNull();
  });
});

describe("First Contribution date", () => {
  it("uses earliest paid monthly_dues contribution createdAt", () => {
    const paidByMonth = new Map<string, string | null>([
      ["2026-07", "2026-08-24T09:15:00.000Z"],
    ]);

    expect(resolveFirstPaidMonthlyDuesContributionDate(paidByMonth)).toBe(
      "2026-08-24T09:15:00.000Z",
    );
  });

  it("passes First Contribution date through the Joined timeline unchanged", () => {
    const memberSince = resolveWelfareJourneyMemberSince({
      createdAt: "2026-08-07T12:00:00.000Z",
      activatedAt: "2026-09-03T10:00:00.000Z",
    });
    const firstContributionDate = "2026-08-24T09:15:00.000Z";

    const timeline = buildJourneyTimeline({
      progression: progression(),
      memberSince,
      firstContributionDate,
    });

    expect(timeline.find((item) => item.id === "joined")?.date).toBe(
      "2026-08-07T12:00:00.000Z",
    );
    expect(timeline.find((item) => item.id === "first_contribution")?.date).toBe(
      "2026-08-24T09:15:00.000Z",
    );
  });
});
