import { PaymentType } from "@/types/enums";

export function resolveInitializePaymentAmount(
  paymentType: PaymentType,
  submittedAmount: number | undefined,
  configuredMonthlyDuesAmount: number,
  selectedMonthCount = 1,
): number {
  if (paymentType === PaymentType.MONTHLY_DUES) {
    const count = Math.max(1, Math.floor(selectedMonthCount));
    return configuredMonthlyDuesAmount * count;
  }

  if (submittedAmount === undefined || !Number.isFinite(submittedAmount) || submittedAmount < 1) {
    throw new Error("Amount must be at least 1.");
  }

  return submittedAmount;
}

export function isMonthlyDuesPaymentType(paymentType: PaymentType): boolean {
  return paymentType === PaymentType.MONTHLY_DUES;
}

export function resolveMemberPaymentFormAmount(
  paymentType: PaymentType,
  monthlyDuesAmount: number,
  editableAmount: string,
): string {
  if (isMonthlyDuesPaymentType(paymentType)) {
    return formatPaymentAmountInput(monthlyDuesAmount);
  }

  return editableAmount;
}

export function formatPaymentAmountInput(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
