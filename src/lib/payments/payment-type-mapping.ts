import { isPaymentType } from "@/lib/payments/labels";
import { ContributionType, PaymentType } from "@/types/enums";

const LEGACY_PAYMENT_TYPE_ALIASES: Record<string, PaymentType> = {
  special: PaymentType.SPECIAL_CONTRIBUTION,
};

export function normalizePaymentType(value: unknown): PaymentType | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (isPaymentType(trimmed)) {
    return trimmed;
  }

  return LEGACY_PAYMENT_TYPE_ALIASES[trimmed] ?? null;
}

export function mapPaymentTypeToContributionType(
  paymentType: PaymentType,
): ContributionType {
  switch (paymentType) {
    case PaymentType.MONTHLY_DUES:
      return ContributionType.MONTHLY_DUES;
    case PaymentType.SPECIAL_CONTRIBUTION:
      return ContributionType.SPECIAL_CONTRIBUTION;
    case PaymentType.OTHER:
      return ContributionType.OTHER;
    case PaymentType.CLAIM_PAYMENT:
      throw new Error(
        "Claim payments are not mapped to contribution types.",
      );
    default: {
      const exhaustive: never = paymentType;
      throw new Error(`Unsupported payment type: ${exhaustive}`);
    }
  }
}

export function resolveContributionTypeFromPayment(
  paymentType: unknown,
): ContributionType | null {
  const normalized = normalizePaymentType(paymentType);
  if (!normalized) {
    return null;
  }

  return mapPaymentTypeToContributionType(normalized);
}
