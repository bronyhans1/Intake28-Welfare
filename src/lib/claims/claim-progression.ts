/**
 * Claims ↔ Membership Progression integration (Phase 3B).
 * Progression values are never recalculated here — they are read from ProgressionEngine.
 */

import { getClaimTypeConfigByCode } from "@/lib/claims/claim-type-repository";
import {
  evaluateMemberEligibilityForClaim,
} from "@/lib/claims/eligibility-service";
import type { MemberEligibilityResult } from "@/lib/claims/eligibility-engine";
import { getProgressionSummary } from "@/lib/progression";
import type { MembershipProgressionSummary } from "@/types/membership-progression";
import type { ClaimProgressionSnapshot } from "@/types/claims";
import type { SerializedClaimTypeConfig } from "@/types/claims";

export const CLAIM_PROGRESSION_REASONS = {
  NOT_ELIGIBLE:
    "You are not currently eligible to submit a welfare claim. Complete at least 6 successful monthly contributions and keep your membership Active.",
  PROGRESSION_MISSING:
    "Membership progression could not be loaded. Please try again or contact the welfare office.",
  CEILING_MISSING:
    "This claim type has no maximum claim ceiling configured. Contact an administrator.",
} as const;

export const ClaimApprovalDecision = {
  RECOMMENDED: "recommended",
  REDUCED: "reduced",
  FULL_CEILING: "full_ceiling",
  FULL_CEILING_PLUS_BONUS: "full_ceiling_plus_bonus",
} as const;

export type ClaimApprovalDecision =
  (typeof ClaimApprovalDecision)[keyof typeof ClaimApprovalDecision];

export const CLAIM_APPROVAL_DECISION_LABELS: Record<
  ClaimApprovalDecision,
  string
> = {
  [ClaimApprovalDecision.RECOMMENDED]: "Approve recommended amount",
  [ClaimApprovalDecision.REDUCED]: "Reduce amount",
  [ClaimApprovalDecision.FULL_CEILING]: "Approve full claim ceiling",
  [ClaimApprovalDecision.FULL_CEILING_PLUS_BONUS]:
    "Approve full ceiling plus bonus",
};

/** Maximum claim ceiling from claim-type configuration (fixedAmount). */
export function resolveClaimCeiling(
  claimType: Pick<SerializedClaimTypeConfig, "fixedAmount" | "displayName">,
): number {
  if (
    typeof claimType.fixedAmount === "number" &&
    claimType.fixedAmount > 0
  ) {
    return claimType.fixedAmount;
  }

  throw new Error(
    `Claim type "${claimType.displayName}" has no maximum claim ceiling. Configure a fixed amount on the claim type.`,
  );
}

/**
 * Recommended Amount = Maximum Claim Ceiling × Benefit Percentage
 */
export function calculateRecommendedBenefitAmount(
  claimCeiling: number,
  benefitPercentage: number,
): number {
  if (!(claimCeiling > 0)) {
    throw new Error("Claim ceiling must be greater than zero.");
  }

  const pct = Math.max(0, Math.min(100, benefitPercentage));
  return Math.round(claimCeiling * (pct / 100) * 100) / 100;
}

export function buildClaimProgressionSnapshot(input: {
  progression: MembershipProgressionSummary;
  recommendedAmount: number;
  claimCeiling: number;
  calculatedAt?: string;
}): ClaimProgressionSnapshot {
  return {
    welfarePoints: input.progression.welfarePoints,
    benefitPercentage: input.progression.benefitPercentage,
    membershipStatus: input.progression.membershipStatus,
    isMature: input.progression.isMature,
    eligibleToClaim: input.progression.eligibleToClaim,
    recommendedAmount: input.recommendedAmount,
    claimCeiling: input.claimCeiling,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  };
}

export interface ClaimSubmissionEligibilityResult extends MemberEligibilityResult {
  welfarePoints: number;
  isMature: boolean;
  eligibleToClaim: boolean;
  membershipProgressionStatus: string;
  recommendedAmount: number | null;
  claimCeiling: number | null;
  progression: MembershipProgressionSummary | null;
}

/**
 * Combined gate for draft create / submit / UI:
 * existing eligibility checks + ProgressionEngine.eligibleToClaim.
 * Benefit % / status / maturity come only from progression.
 */
export async function evaluateClaimSubmissionEligibility(params: {
  memberId: string;
  claimTypeCode: string;
  asOf?: Date;
}): Promise<ClaimSubmissionEligibilityResult | { error: string }> {
  const [base, progression, claimType] = await Promise.all([
    evaluateMemberEligibilityForClaim(params),
    getProgressionSummary(params.memberId),
    getClaimTypeConfigByCode(params.claimTypeCode),
  ]);

  if ("error" in base) {
    return base;
  }

  if (!progression) {
    return {
      ...base,
      eligible: false,
      reasons: [CLAIM_PROGRESSION_REASONS.PROGRESSION_MISSING],
      welfarePoints: 0,
      isMature: false,
      eligibleToClaim: false,
      membershipProgressionStatus: "UNKNOWN",
      benefitPercentage: 0,
      memberStatus: base.memberStatus,
      recommendedAmount: null,
      claimCeiling: null,
      progression: null,
    };
  }

  const reasons: string[] = [];
  if (!base.eligible) {
    reasons.push(...base.reasons);
  }
  if (!progression.eligibleToClaim) {
    reasons.push(CLAIM_PROGRESSION_REASONS.NOT_ELIGIBLE);
  }

  let claimCeiling: number | null = null;
  let recommendedAmount: number | null = null;

  if (claimType) {
    try {
      claimCeiling = resolveClaimCeiling(claimType);
      recommendedAmount = calculateRecommendedBenefitAmount(
        claimCeiling,
        progression.benefitPercentage,
      );
    } catch {
      claimCeiling = null;
      recommendedAmount = null;
      reasons.push(CLAIM_PROGRESSION_REASONS.CEILING_MISSING);
    }
  } else {
    reasons.push("Claim type configuration was not found.");
  }

  const eligible =
    base.eligible &&
    progression.eligibleToClaim &&
    claimCeiling != null &&
    recommendedAmount != null;

  return {
    ...base,
    eligible,
    reasons: [...new Set(reasons)],
    warnings: base.warnings,
    benefitPercentage: progression.benefitPercentage,
    memberStatus: progression.membershipStatus,
    welfarePoints: progression.welfarePoints,
    isMature: progression.isMature,
    eligibleToClaim: progression.eligibleToClaim,
    membershipProgressionStatus: progression.membershipStatus,
    recommendedAmount,
    claimCeiling,
    progression,
  };
}

/** Assert progression eligibility before create/submit — throws with clear message. */
export async function assertMemberEligibleToClaim(
  memberId: string,
): Promise<MembershipProgressionSummary> {
  const progression = await getProgressionSummary(memberId);
  if (!progression) {
    throw new Error(CLAIM_PROGRESSION_REASONS.PROGRESSION_MISSING);
  }
  if (!progression.eligibleToClaim) {
    throw new Error(CLAIM_PROGRESSION_REASONS.NOT_ELIGIBLE);
  }
  return progression;
}

export async function loadProgressionSnapshotForClaim(input: {
  memberId: string;
  claimTypeCode: string;
}): Promise<{
  progression: MembershipProgressionSummary;
  snapshot: ClaimProgressionSnapshot;
  recommendedAmount: number;
  claimCeiling: number;
}> {
  const progression = await assertMemberEligibleToClaim(input.memberId);
  const claimType = await getClaimTypeConfigByCode(input.claimTypeCode);
  if (!claimType) {
    throw new Error("Claim type configuration was not found.");
  }

  const claimCeiling = resolveClaimCeiling(claimType);
  const recommendedAmount = calculateRecommendedBenefitAmount(
    claimCeiling,
    progression.benefitPercentage,
  );
  const snapshot = buildClaimProgressionSnapshot({
    progression,
    recommendedAmount,
    claimCeiling,
  });

  return { progression, snapshot, recommendedAmount, claimCeiling };
}

export interface ResolvedApprovalAmounts {
  decision: ClaimApprovalDecision;
  recommendedAmount: number;
  claimCeiling: number;
  approvedAmount: number;
  bonusAmount: number;
  finalAmount: number;
  overrideReason: string | null;
}

export function resolveExecutiveApprovalAmounts(input: {
  decision: ClaimApprovalDecision;
  recommendedAmount: number;
  claimCeiling: number;
  approvedAmount?: number | null;
  bonusAmount?: number | null;
  overrideReason?: string | null;
}): ResolvedApprovalAmounts {
  const recommendedAmount = input.recommendedAmount;
  const claimCeiling = input.claimCeiling;
  const reason = input.overrideReason?.trim() || null;

  if (!(recommendedAmount >= 0) || !(claimCeiling > 0)) {
    throw new Error("Claim is missing a recommended amount or claim ceiling.");
  }

  switch (input.decision) {
    case ClaimApprovalDecision.RECOMMENDED: {
      return {
        decision: input.decision,
        recommendedAmount,
        claimCeiling,
        approvedAmount: recommendedAmount,
        bonusAmount: 0,
        finalAmount: recommendedAmount,
        overrideReason: reason,
      };
    }
    case ClaimApprovalDecision.REDUCED: {
      if (!reason) {
        throw new Error("A reason is required when reducing the recommended amount.");
      }
      const approvedAmount = input.approvedAmount;
      if (typeof approvedAmount !== "number" || !(approvedAmount > 0)) {
        throw new Error("Enter a positive reduced amount.");
      }
      if (approvedAmount >= recommendedAmount) {
        throw new Error(
          "Reduced amount must be less than the recommended amount.",
        );
      }
      return {
        decision: input.decision,
        recommendedAmount,
        claimCeiling,
        approvedAmount,
        bonusAmount: 0,
        finalAmount: approvedAmount,
        overrideReason: reason,
      };
    }
    case ClaimApprovalDecision.FULL_CEILING: {
      if (!reason) {
        throw new Error("A reason is required when approving the full claim ceiling.");
      }
      return {
        decision: input.decision,
        recommendedAmount,
        claimCeiling,
        approvedAmount: claimCeiling,
        bonusAmount: 0,
        finalAmount: claimCeiling,
        overrideReason: reason,
      };
    }
    case ClaimApprovalDecision.FULL_CEILING_PLUS_BONUS: {
      if (!reason) {
        throw new Error(
          "A reason is required when approving the full ceiling plus a bonus.",
        );
      }
      const bonusAmount = input.bonusAmount;
      if (typeof bonusAmount !== "number" || !(bonusAmount > 0)) {
        throw new Error("Enter a bonus amount greater than zero.");
      }
      const finalAmount =
        Math.round((claimCeiling + bonusAmount) * 100) / 100;
      return {
        decision: input.decision,
        recommendedAmount,
        claimCeiling,
        approvedAmount: claimCeiling,
        bonusAmount,
        finalAmount,
        overrideReason: reason,
      };
    }
    default:
      throw new Error("Unsupported approval decision.");
  }
}
