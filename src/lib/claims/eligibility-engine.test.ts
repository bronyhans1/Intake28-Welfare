import { describe, expect, it } from "vitest";
import {
  ELIGIBILITY_REASONS,
  ELIGIBILITY_WARNINGS,
  evaluateMemberEligibility,
  resolveMemberParticipationStatus,
} from "@/lib/claims/eligibility-engine";
import { UserStatus } from "@/types/enums";
import type { EligibilityMemberInput } from "@/lib/claims/eligibility-engine";

const asOf = new Date("2026-07-25T12:00:00.000Z");

const completeMember = (
  overrides: Partial<EligibilityMemberInput> = {},
): EligibilityMemberInput => ({
  status: UserStatus.ACTIVE,
  isDefaulter: false,
  parentInformationCompleted: true,
  motherFullName: "Jane Doe",
  motherStatus: "alive",
  fatherFullName: "John Doe",
  fatherStatus: "deceased",
  fullName: "Member Name",
  phoneNumber: "0241234567",
  email: "member@example.com",
  dateOfBirth: { seconds: 632448000, nanoseconds: 0 },
  rank: "Inspector",
  station: "HQ",
  nextOfKin: "Next Of Kin",
  emergencyContact: "0249999999",
  profilePhotoUrl: "https://example.com/photo.webp",
  activatedAt: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const claimType = {
  waitingPeriodDays: 180,
  benefitPercentage: 75,
};

const constitution = {
  displayName: "2026 Constitution",
  versionNumber: "2026.1",
};

describe("resolveMemberParticipationStatus", () => {
  it("reports Defaulting when the member is a defaulter", () => {
    expect(
      resolveMemberParticipationStatus({
        status: UserStatus.ACTIVE,
        isDefaulter: true,
      }),
    ).toBe("Defaulting");
  });

  it("maps UserStatus values", () => {
    expect(
      resolveMemberParticipationStatus({ status: UserStatus.SUSPENDED }),
    ).toBe("Suspended");
    expect(
      resolveMemberParticipationStatus({ status: UserStatus.INACTIVE }),
    ).toBe("Inactive");
  });
});

describe("evaluateMemberEligibility", () => {
  it("returns eligible for an active member who meets all checks", () => {
    const result = evaluateMemberEligibility({
      member: completeMember(),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.memberStatus).toBe("Active");
    expect(result.benefitPercentage).toBe(75);
    expect(result.constitutionVersion).toContain("2026 Constitution");
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("rejects a suspended member", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({ status: UserStatus.SUSPENDED }),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.memberStatus).toBe("Suspended");
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.MEMBERSHIP_STATUS);
    expect(
      result.checks.find((check) => check.key === "membershipStatus")?.passed,
    ).toBe(false);
  });

  it("rejects an inactive member", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({ status: UserStatus.INACTIVE }),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.memberStatus).toBe("Inactive");
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.MEMBERSHIP_STATUS);
  });

  it("rejects a defaulting member", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({ isDefaulter: true }),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.memberStatus).toBe("Defaulting");
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.MEMBERSHIP_STATUS);
  });

  it("rejects when Parent Information is missing", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({
        parentInformationCompleted: false,
        motherFullName: null,
        motherStatus: null,
        fatherFullName: null,
        fatherStatus: null,
      }),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.PARENT_INFORMATION);
    expect(
      result.checks.find((check) => check.key === "parentInformation")?.passed,
    ).toBe(false);
  });

  it("rejects when the profile is incomplete", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({
        email: null,
        rank: null,
        station: null,
        nextOfKin: null,
        emergencyContact: null,
        profilePhotoUrl: null,
      }),
      claimTypeConfig: claimType,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.PROFILE_INCOMPLETE);
    expect(
      result.checks.find((check) => check.key === "profileCompletion")?.passed,
    ).toBe(false);
  });

  it("passes when the waiting period is satisfied", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({
        activatedAt: "2025-01-01T00:00:00.000Z",
      }),
      claimTypeConfig: { waitingPeriodDays: 180, benefitPercentage: 50 },
      constitution,
      asOf,
    });

    expect(
      result.checks.find((check) => check.key === "waitingPeriod")?.passed,
    ).toBe(true);
    expect(result.reasons).not.toContain(ELIGIBILITY_REASONS.WAITING_PERIOD);
    expect(result.benefitPercentage).toBe(50);
    expect(result.membershipDays).toBeGreaterThanOrEqual(180);
  });

  it("rejects when the waiting period is not satisfied", () => {
    const result = evaluateMemberEligibility({
      member: completeMember({
        activatedAt: "2026-07-01T00:00:00.000Z",
      }),
      claimTypeConfig: { waitingPeriodDays: 365, benefitPercentage: 75 },
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.WAITING_PERIOD);
    expect(
      result.checks.find((check) => check.key === "waitingPeriod")?.passed,
    ).toBe(false);
  });

  it("rejects when claim type configuration is missing", () => {
    const result = evaluateMemberEligibility({
      member: completeMember(),
      claimTypeConfig: null,
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.CLAIM_TYPE_MISSING);
    expect(result.benefitPercentage).toBe(0);
    expect(
      result.checks.find((check) => check.key === "waitingPeriod")?.passed,
    ).toBe(false);
  });

  it("returns a warning when no active constitution is present", () => {
    const result = evaluateMemberEligibility({
      member: completeMember(),
      claimTypeConfig: claimType,
      constitution: null,
      asOf,
    });

    expect(result.eligible).toBe(true);
    expect(result.constitutionVersion).toBe("");
    expect(result.warnings).toContain(ELIGIBILITY_WARNINGS.CONSTITUTION_MISSING);
  });

  it("rejects incomplete claim type configuration fields", () => {
    const result = evaluateMemberEligibility({
      member: completeMember(),
      claimTypeConfig: {
        waitingPeriodDays: null,
        benefitPercentage: 75,
      },
      constitution,
      asOf,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(ELIGIBILITY_REASONS.CLAIM_TYPE_INCOMPLETE);
  });
});
