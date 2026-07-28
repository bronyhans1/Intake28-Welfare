import {
  PaymentCategory,
  PaymentType,
} from "@/types/enums";

/**
 * Maps payment types to ledger categories.
 * Keeps category logic centralized — do not scatter category switches in UI.
 */
export function resolvePaymentCategory(
  paymentType: PaymentType | string | null | undefined,
  explicitCategory?: PaymentCategory | null,
): PaymentCategory {
  if (explicitCategory) {
    return explicitCategory;
  }

  switch (paymentType) {
    case PaymentType.SPECIAL_CONTRIBUTION:
      return PaymentCategory.SPECIAL_CONTRIBUTION;
    case PaymentType.CLAIM_PAYMENT:
      return PaymentCategory.CLAIM;
    case PaymentType.MONTHLY_DUES:
    case PaymentType.OTHER:
    default:
      return PaymentCategory.CONTRIBUTION;
  }
}

export function isClaimPaymentCategory(
  category: PaymentCategory | string | null | undefined,
): boolean {
  return category === PaymentCategory.CLAIM;
}

export function isContributionLedgerCategory(
  category: PaymentCategory | string | null | undefined,
): boolean {
  return (
    category === PaymentCategory.CONTRIBUTION ||
    category === PaymentCategory.SPECIAL_CONTRIBUTION
  );
}
