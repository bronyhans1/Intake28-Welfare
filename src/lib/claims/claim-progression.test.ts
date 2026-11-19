import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimAmountMode } from "@/types/enums";

vi.mock("@/lib/claims/eligibility-service", () => ({
  evaluateMemberEligibilityForClaim: vi.fn(),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn(),
}));

vi.mock("@/lib/progression", () => ({
  getProgressionSummary: vi.fn(),
}));

import { evaluateMemberEligibilityForClaim } from "@/lib/claims/eligibility-service";
import { getClaimTypeConfigByCode } from "@/lib/claims/claim-type-repository";
import { getProgressionSummary } from "@/lib/progression";
import {
  calculateRecommendedBenefitAmount,
  CLAIM_PROGRESSION_REASONS,
  ClaimApprovalDecision,
  claimTypeRequiresMaximumClaimCeiling,
  evaluateClaimSubmissionEligibility,
  resolveClaimCeiling,
  resolveExecutiveApprovalAmounts,
} from "@/lib/claims/claim-progression";

const evaluateBase = vi.mocked(evaluateMemberEligibilityForClaim);
const getClaimType = vi.mocked(getClaimTypeConfigByCode);
const getProgression = vi.mocked(getProgressionSummary);

const eligibleBase = {
  eligible: true,
  reasons: [],
  warnings: [],
  memberStatus: "Active",
  constitutionVersion: "2026 Constitution (2026.1)",
  benefitPercentage: 0,
  checks: [],
  waitingPeriodDays: 180,
  membershipDays: 400,
};

const eligibleProgression = {
  memberId: "m1",
  welfarePoints: 10,
  benefitPercentage: 50,
  successfulContributionMonths: 10,
  consecutiveContributionMonths: 10,
  consecutiveMissedMonths: 0,
  isMature: true,
  eligibleToClaim: true,
  membershipStatus: "ACTIVE",
  maturityDate: "2026-01-01T00:00:00.000Z",
  lastSuccessfulContributionDate: "2026-08-01T00:00:00.000Z",
  membershipStartMonth: 1,
  membershipStartYear: 2026,
  calculatedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("calculateRecommendedBenefitAmount", () => {
  it("computes ceiling × benefit percentage", () => {
    expect(calculateRecommendedBenefitAmount(1000, 25)).toBe(250);
    expect(calculateRecommendedBenefitAmount(1000, 55)).toBe(550);
    expect(calculateRecommendedBenefitAmount(1000, 100)).toBe(1000);
    expect(calculateRecommendedBenefitAmount(1000, 0)).toBe(0);
  });
});

describe("claimTypeRequiresMaximumClaimCeiling", () => {
  it("does not require a ceiling for Executive Decision (manual)", () => {
    expect(
      claimTypeRequiresMaximumClaimCeiling(ClaimAmountMode.MANUAL),
    ).toBe(false);
  });

  it("requires a ceiling for Fixed Amount and Percentage of Contribution", () => {
    expect(
      claimTypeRequiresMaximumClaimCeiling(ClaimAmountMode.FIXED),
    ).toBe(true);
    expect(
      claimTypeRequiresMaximumClaimCeiling(ClaimAmountMode.FORMULA),
    ).toBe(true);
  });
});

describe("resolveClaimCeiling", () => {
  it("uses claim-type fixedAmount as the ceiling", () => {
    expect(
      resolveClaimCeiling({
        fixedAmount: 2000,
        displayName: "Medical",
        amountMode: ClaimAmountMode.FIXED,
      }),
    ).toBe(2000);
  });

  it("throws when ceiling is missing", () => {
    expect(() =>
      resolveClaimCeiling({
        fixedAmount: null,
        displayName: "Medical",
        amountMode: ClaimAmountMode.FIXED,
      }),
    ).toThrow(/ceiling/i);
  });
});

describe("evaluateClaimSubmissionEligibility — benefit amount methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateBase.mockResolvedValue(eligibleBase);
    getProgression.mockResolvedValue(eligibleProgression as never);
  });

  it("A: Executive Decision + no maximum ceiling does not fail for missing ceiling", async () => {
    getClaimType.mockResolvedValue({
      code: "child_birth",
      displayName: "Child Birth",
      amountMode: ClaimAmountMode.MANUAL,
      fixedAmount: null,
    } as never);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "child_birth",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(true);
    expect(result.reasons).not.toContain(CLAIM_PROGRESSION_REASONS.CEILING_MISSING);
    expect(result.claimCeiling).toBeNull();
    expect(result.recommendedAmount).toBeNull();
  });

  it("B: Fixed Amount without ceiling still fails eligibility", async () => {
    getClaimType.mockResolvedValue({
      code: "medical_support",
      displayName: "Medical Support",
      amountMode: ClaimAmountMode.FIXED,
      fixedAmount: null,
    } as never);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "medical_support",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CLAIM_PROGRESSION_REASONS.CEILING_MISSING);
  });

  it("B: Fixed Amount with configured ceiling remains eligible", async () => {
    getClaimType.mockResolvedValue({
      code: "medical_support",
      displayName: "Medical Support",
      amountMode: ClaimAmountMode.FIXED,
      fixedAmount: 1000,
    } as never);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "medical_support",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(true);
    expect(result.claimCeiling).toBe(1000);
    expect(result.recommendedAmount).toBe(500);
  });

  it("C: Percentage of Contribution without ceiling still fails eligibility", async () => {
    getClaimType.mockResolvedValue({
      code: "pct_claim",
      displayName: "Percentage Claim",
      amountMode: ClaimAmountMode.FORMULA,
      fixedAmount: null,
      formulaKey: "contribution_pct",
    } as never);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "pct_claim",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CLAIM_PROGRESSION_REASONS.CEILING_MISSING);
  });

  it("C: Percentage of Contribution with configured ceiling remains eligible", async () => {
    getClaimType.mockResolvedValue({
      code: "pct_claim",
      displayName: "Percentage Claim",
      amountMode: ClaimAmountMode.FORMULA,
      fixedAmount: 2000,
      formulaKey: "contribution_pct",
    } as never);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "pct_claim",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(true);
    expect(result.claimCeiling).toBe(2000);
    expect(result.recommendedAmount).toBe(1000);
  });

  it("D: missing claim type still produces a configuration error", async () => {
    getClaimType.mockResolvedValue(null);

    const result = await evaluateClaimSubmissionEligibility({
      memberId: "m1",
      claimTypeCode: "unknown_type",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Claim type configuration was not found.");
    expect(result.reasons).not.toContain(CLAIM_PROGRESSION_REASONS.CEILING_MISSING);
  });
});

describe("resolveExecutiveApprovalAmounts", () => {
  it("approves the recommended amount", () => {
    const result = resolveExecutiveApprovalAmounts({
      decision: ClaimApprovalDecision.RECOMMENDED,
      recommendedAmount: 250,
      claimCeiling: 1000,
    });
    expect(result.finalAmount).toBe(250);
    expect(result.bonusAmount).toBe(0);
    expect(result.overrideReason).toBeNull();
  });

  it("requires a reason and lower amount when reducing", () => {
    expect(() =>
      resolveExecutiveApprovalAmounts({
        decision: ClaimApprovalDecision.REDUCED,
        recommendedAmount: 250,
        claimCeiling: 1000,
        approvedAmount: 200,
      }),
    ).toThrow(/reason/i);

    const result = resolveExecutiveApprovalAmounts({
      decision: ClaimApprovalDecision.REDUCED,
      recommendedAmount: 250,
      claimCeiling: 1000,
      approvedAmount: 200,
      overrideReason: "Partial coverage only",
    });
    expect(result.finalAmount).toBe(200);
  });

  it("approves full ceiling with reason", () => {
    const result = resolveExecutiveApprovalAmounts({
      decision: ClaimApprovalDecision.FULL_CEILING,
      recommendedAmount: 250,
      claimCeiling: 1000,
      overrideReason: "Exceptional circumstances",
    });
    expect(result.finalAmount).toBe(1000);
    expect(result.approvedAmount).toBe(1000);
  });

  it("approves full ceiling plus bonus", () => {
    const result = resolveExecutiveApprovalAmounts({
      decision: ClaimApprovalDecision.FULL_CEILING_PLUS_BONUS,
      recommendedAmount: 250,
      claimCeiling: 1000,
      bonusAmount: 100,
      overrideReason: "Hardship bonus",
    });
    expect(result.finalAmount).toBe(1100);
    expect(result.bonusAmount).toBe(100);
    expect(result.approvedAmount).toBe(1000);
  });
});
