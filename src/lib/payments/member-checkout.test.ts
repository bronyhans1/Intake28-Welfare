import { afterEach, describe, expect, it, vi } from "vitest";
import { PAYMENTS_UNAVAILABLE_MESSAGE } from "@/lib/payments/availability";
import {
  areMemberOnlinePaymentsAvailable,
  canRetryPendingPaymentStatus,
  formatPaymentProviderLabel,
  getMemberOnlinePaymentsAvailabilityDiagnostics,
  getMemberOnlinePaymentsUnavailableMessage,
  memberPaymentPendingExplanation,
  memberPaymentVerifiedMessage,
  memberPaymentVerifyStatusMessage,
  resolveMemberPaymentReturnState,
} from "@/lib/payments/member-checkout";
import { PaymentProvider, PaymentStatus } from "@/types/enums";

describe("member Hubtel checkout availability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.HUBTEL_PAYMENT_API_ID;
    delete process.env.HUBTEL_PAYMENT_API_KEY;
    delete process.env.PAYMENTS_ENABLED;
  });

  it("requires both PAYMENTS_ENABLED and Hubtel credentials", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    process.env.PAYMENTS_ENABLED = "true";
    expect(areMemberOnlinePaymentsAvailable()).toBe(false);
    expect(getMemberOnlinePaymentsAvailabilityDiagnostics()).toMatchObject({
      paymentsEnabled: true,
      hubtelConfigured: false,
      available: false,
      unavailableReason: "hubtel_credentials_missing",
    });

    process.env.HUBTEL_PAYMENT_API_ID = "id";
    process.env.HUBTEL_PAYMENT_API_KEY = "key";
    expect(areMemberOnlinePaymentsAvailable()).toBe(true);
    expect(getMemberOnlinePaymentsAvailabilityDiagnostics().unavailableReason).toBeNull();
  });

  it("stays unavailable when payments are disabled even with Hubtel credentials", () => {
    process.env.HUBTEL_PAYMENT_API_ID = "id";
    process.env.HUBTEL_PAYMENT_API_KEY = "key";
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    process.env.PAYMENTS_ENABLED = "false";
    expect(areMemberOnlinePaymentsAvailable()).toBe(false);
    expect(getMemberOnlinePaymentsAvailabilityDiagnostics()).toMatchObject({
      paymentsEnabled: false,
      hubtelConfigured: true,
      available: false,
      unavailableReason: "payments_disabled",
    });
    expect(getMemberOnlinePaymentsUnavailableMessage()).toBe(
      PAYMENTS_UNAVAILABLE_MESSAGE,
    );
  });

  it("explains missing Hubtel configuration separately", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    process.env.PAYMENTS_ENABLED = "true";
    delete process.env.HUBTEL_PAYMENT_API_ID;
    delete process.env.HUBTEL_PAYMENT_API_KEY;
    expect(getMemberOnlinePaymentsUnavailableMessage()).toMatch(
      /Online payment is currently unavailable/i,
    );
  });

  it("uses the payments-disabled message when PAYMENTS_ENABLED is absent", () => {
    delete process.env.PAYMENTS_ENABLED;
    process.env.HUBTEL_PAYMENT_API_ID = "id";
    process.env.HUBTEL_PAYMENT_API_KEY = "key";
    expect(getMemberOnlinePaymentsAvailabilityDiagnostics().unavailableReason).toBe(
      "payments_disabled",
    );
    expect(getMemberOnlinePaymentsUnavailableMessage()).toBe(
      PAYMENTS_UNAVAILABLE_MESSAGE,
    );
  });
});

describe("member payment return and status messaging", () => {
  it("resolves return query states without inventing success", () => {
    expect(resolveMemberPaymentReturnState({ pending: "1" })).toBe("pending");
    expect(resolveMemberPaymentReturnState({ verified: "1" })).toBe("verified");
    expect(resolveMemberPaymentReturnState({ error: "verification_failed" })).toBe(
      "error",
    );
    expect(resolveMemberPaymentReturnState({ cancelled: "1" })).toBe("cancelled");
    expect(resolveMemberPaymentReturnState({})).toBeNull();
  });

  it("keeps pending outcomes explanatory and non-success", () => {
    expect(memberPaymentPendingExplanation()).toMatch(/still pending/i);
    expect(memberPaymentPendingExplanation()).toMatch(/not started automatically/i);
    expect(memberPaymentPendingExplanation()).not.toMatch(/Hubtel/i);
    expect(memberPaymentVerifyStatusMessage(PaymentStatus.PENDING)).toMatch(
      /still pending|confirmed/i,
    );
    expect(memberPaymentVerifyStatusMessage(PaymentStatus.SUCCESS)).toBe(
      memberPaymentVerifiedMessage(),
    );
  });

  it("labels Hubtel and Paystack providers in payment history", () => {
    expect(formatPaymentProviderLabel(PaymentProvider.HUBTEL)).toBe("Hubtel");
    expect(formatPaymentProviderLabel(PaymentProvider.PAYSTACK)).toBe("Paystack");
    expect(canRetryPendingPaymentStatus(PaymentStatus.PENDING)).toBe(true);
    expect(canRetryPendingPaymentStatus(PaymentStatus.SUCCESS)).toBe(false);
  });
});
