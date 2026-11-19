import { ClaimAmountMode } from "@/types/enums";
import type { SerializedClaim, SerializedClaimTypeConfig } from "@/types/claims";

/**
 * Resolves the approved benefit amount (GHS) used as the Finance payment ceiling.
 * Prefers claim-type fixed amount, then member requested amount.
 */
export function resolveApprovedBenefitAmount(
  claim: Pick<SerializedClaim, "requestedAmount" | "claimTypeCode">,
  claimType: Pick<
    SerializedClaimTypeConfig,
    "amountMode" | "fixedAmount" | "displayName"
  >,
): number {
  if (
    claimType.amountMode === ClaimAmountMode.FIXED &&
    typeof claimType.fixedAmount === "number" &&
    claimType.fixedAmount > 0
  ) {
    return claimType.fixedAmount;
  }

  if (
    typeof claimType.fixedAmount === "number" &&
    claimType.fixedAmount > 0
  ) {
    return claimType.fixedAmount;
  }

  if (
    typeof claim.requestedAmount === "number" &&
    claim.requestedAmount > 0
  ) {
    return claim.requestedAmount;
  }

  throw new Error(
    `Cannot determine approved benefit amount for claim type "${claimType.displayName}". Configure a fixed amount on the claim type or ensure the claim has a requested amount.`,
  );
}

export function assertClaimPaymentAmountAllowed(input: {
  approvedBenefitAmount: number;
  paymentAmount: number;
  reductionReason?: string | null;
}): void {
  const approved = input.approvedBenefitAmount;
  const amount = input.paymentAmount;

  if (!(amount > 0)) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (amount > approved) {
    throw new Error(
      `Payment amount cannot exceed the approved benefit of GHS ${approved.toFixed(2)}.`,
    );
  }

  if (amount < approved) {
    const reason = input.reductionReason?.trim() ?? "";
    if (!reason) {
      throw new Error(
        "An explanation is required when the payment amount is less than the approved benefit.",
      );
    }
  }
}
