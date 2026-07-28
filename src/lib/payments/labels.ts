import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PaymentStatus,
  PaymentType,
} from "@/types/enums";

export function isPaymentType(value: string): value is PaymentType {
  return Object.values(PaymentType).includes(value as PaymentType);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return Object.values(PaymentStatus).includes(value as PaymentStatus);
}

export function formatPaymentTypeLabel(
  value: string | PaymentType | null | undefined,
): string {
  if (!value) return "—";
  if (isPaymentType(value)) {
    return PAYMENT_TYPE_LABELS[value];
  }
  return value;
}

export function formatPaymentStatusLabel(
  value: string | PaymentStatus | null | undefined,
): string {
  if (!value) return "—";
  if (isPaymentStatus(value)) {
    return PAYMENT_STATUS_LABELS[value];
  }
  return value;
}

export function formatPaymentStatusFilterLabel(
  value: string,
  allLabel = "All Statuses",
): string {
  if (!value || value === "all") return allLabel;
  return formatPaymentStatusLabel(value);
}

export function formatPaymentTypeFilterLabel(
  value: string,
  allLabel = "All Types",
): string {
  if (!value || value === "all") return allLabel;
  return formatPaymentTypeLabel(value);
}
