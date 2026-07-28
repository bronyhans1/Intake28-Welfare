import { describe, expect, it } from "vitest";
import {
  calculateRecommendedBenefitAmount,
  ClaimApprovalDecision,
  resolveClaimCeiling,
  resolveExecutiveApprovalAmounts,
} from "@/lib/claims/claim-progression";

describe("calculateRecommendedBenefitAmount", () => {
  it("computes ceiling × benefit percentage", () => {
    expect(calculateRecommendedBenefitAmount(1000, 25)).toBe(250);
    expect(calculateRecommendedBenefitAmount(1000, 55)).toBe(550);
    expect(calculateRecommendedBenefitAmount(1000, 100)).toBe(1000);
    expect(calculateRecommendedBenefitAmount(1000, 0)).toBe(0);
  });
});

describe("resolveClaimCeiling", () => {
  it("uses claim-type fixedAmount as the ceiling", () => {
    expect(
      resolveClaimCeiling({ fixedAmount: 2000, displayName: "Medical" }),
    ).toBe(2000);
  });

  it("throws when ceiling is missing", () => {
    expect(() =>
      resolveClaimCeiling({ fixedAmount: null, displayName: "Medical" }),
    ).toThrow(/ceiling/i);
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
