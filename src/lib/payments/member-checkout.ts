import { isHubtelPaymentConfigured } from "@/lib/integrations/hubtel/checkout-config";
import {
  isPaymentsEnabled,
  PAYMENTS_UNAVAILABLE_MESSAGE,
} from "@/lib/payments/availability";
import { PAYMENT_PROVIDER_LABELS, PaymentProvider, PaymentStatus } from "@/types/enums";

/**
 * Member-facing online checkout is available only when initiation is explicitly
 * enabled and Hubtel Online Checkout credentials are present.
 * Fail-closed: never show checkout as operational when either gate fails.
 *
 * Safe diagnostics only — never log credential values.
 */
export function getMemberOnlinePaymentsAvailabilityDiagnostics(): {
  paymentsEnabled: boolean;
  hubtelConfigured: boolean;
  available: boolean;
  unavailableReason:
    | "payments_disabled"
    | "hubtel_credentials_missing"
    | null;
} {
  const paymentsEnabled = isPaymentsEnabled();
  const hubtelConfigured = isHubtelPaymentConfigured();
  const available = paymentsEnabled && hubtelConfigured;
  return {
    paymentsEnabled,
    hubtelConfigured,
    available,
    unavailableReason: available
      ? null
      : !paymentsEnabled
        ? "payments_disabled"
        : "hubtel_credentials_missing",
  };
}

export function areMemberOnlinePaymentsAvailable(): boolean {
  return getMemberOnlinePaymentsAvailabilityDiagnostics().available;
}

export function getMemberOnlinePaymentsUnavailableMessage(): string {
  const diagnostics = getMemberOnlinePaymentsAvailabilityDiagnostics();
  if (!diagnostics.paymentsEnabled) {
    return PAYMENTS_UNAVAILABLE_MESSAGE;
  }
  if (!diagnostics.hubtelConfigured) {
    return "Online payment is currently unavailable. Your contribution records and receipts remain accessible.";
  }
  return PAYMENTS_UNAVAILABLE_MESSAGE;
}

/** Server-only boolean diagnostics for local/ops troubleshooting. */
export function logMemberOnlinePaymentsAvailability(context: string): void {
  const diagnostics = getMemberOnlinePaymentsAvailabilityDiagnostics();
  console.info("[payments:availability]", context, diagnostics);
}

export type MemberPaymentReturnState =
  | "verified"
  | "pending"
  | "error"
  | "cancelled"
  | null;

export function resolveMemberPaymentReturnState(params: {
  verified?: string | null;
  pending?: string | null;
  error?: string | null;
  cancelled?: string | null;
}): MemberPaymentReturnState {
  if (params.error) return "error";
  if (params.pending === "1") return "pending";
  if (params.verified === "1") return "verified";
  if (params.cancelled === "1") return "cancelled";
  return null;
}

export function memberPaymentPendingExplanation(): string {
  return "Your payment is still pending while the transaction is confirmed. This page does not mark a payment as successful until server-side verification completes. You can check the status below — a new payment is not started automatically.";
}

export function memberPaymentVerifiedMessage(): string {
  return "Payment verified successfully.";
}

export function memberPaymentVerifyStatusMessage(
  status: string | null | undefined,
): string {
  if (status === PaymentStatus.SUCCESS) {
    return memberPaymentVerifiedMessage();
  }
  if (status === PaymentStatus.PENDING) {
    return memberPaymentPendingExplanation();
  }
  if (status === PaymentStatus.FAILED || status === PaymentStatus.ABANDONED) {
    return `Payment status: ${status}. No new payment was started. Check your history or contact support if you were charged.`;
  }
  return `Payment status: ${status ?? "updated"}.`;
}

/**
 * Member-facing provider labels for payment history / badges.
 * Shows the actual provider (Hubtel, Paystack, Manual). Internal codes unchanged.
 */
export function formatPaymentProviderLabel(
  provider: string | null | undefined,
): string {
  if (!provider) return "—";
  if (provider === PaymentProvider.HUBTEL) {
    return PAYMENT_PROVIDER_LABELS[PaymentProvider.HUBTEL];
  }
  if (provider === PaymentProvider.PAYSTACK) {
    return PAYMENT_PROVIDER_LABELS[PaymentProvider.PAYSTACK];
  }
  if (provider === PaymentProvider.MANUAL) {
    return PAYMENT_PROVIDER_LABELS[PaymentProvider.MANUAL];
  }
  return provider;
}

export function canRetryPendingPaymentStatus(status: string): boolean {
  return status === PaymentStatus.PENDING;
}
