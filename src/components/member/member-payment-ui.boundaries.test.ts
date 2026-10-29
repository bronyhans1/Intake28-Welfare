import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

describe("member payment UI Hubtel-only boundaries", () => {
  it("removes member-facing manual MoMo panel usage", () => {
    const outstanding = readSrc(
      "components/member/member-outstanding-contributions-payment.tsx",
    );
    const contributionsPage = readSrc(
      "app/(protected)/portal/contributions/page.tsx",
    );

    expect(outstanding).not.toContain("ManualMomoPaymentPanel");
    expect(outstanding).not.toContain("manual-momo-payment-panel");
    expect(outstanding).not.toContain("Pay Directly via Mobile Money");
    expect(outstanding).toContain("Pay");
    expect(outstanding).not.toMatch(/with Hubtel/);
    expect(outstanding).toContain("Redirecting to checkout");
    expect(outstanding).toMatch(/Online payment is\s+currently unavailable/);
    expect(outstanding).toContain("onlineCheckoutAvailable");
    expect(contributionsPage).toContain("areMemberOnlinePaymentsAvailable");
    expect(contributionsPage).not.toContain("serviceNumber=");
  });

  it("does not ship the manual MoMo panel component", () => {
    let exists = true;
    try {
      readSrc("components/member/manual-momo-payment-panel.tsx");
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it("keeps payment history provider-aware with Hubtel and Paystack labels", () => {
    const paymentsPage = readSrc("app/(protected)/payments/page.tsx");
    const memberPayments = readSrc("components/member/member-payments.tsx");
    const providerBadge = readSrc("components/member/payments-badge.tsx");
    const memberCheckout = readSrc("lib/payments/member-checkout.ts");

    expect(paymentsPage).not.toMatch(/Track your Paystack welfare payments/);
    expect(paymentsPage).toMatch(/Track your welfare payments and verification status/);
    expect(memberPayments).toContain("PaymentProviderBadge");
    expect(memberPayments).toContain("Check status");
    expect(memberPayments).toContain("memberPaymentPendingExplanation");
    expect(memberPayments).toContain("pending=1");
    expect(memberPayments).not.toMatch(/with Hubtel/);
    expect(providerBadge).toContain("formatPaymentProviderLabel");
    expect(memberCheckout).toMatch(
      /PaymentProvider\.HUBTEL[\s\S]*?PAYMENT_PROVIDER_LABELS\[PaymentProvider\.HUBTEL\]/,
    );
    expect(memberCheckout).toMatch(
      /PaymentProvider\.PAYSTACK[\s\S]*?PAYMENT_PROVIDER_LABELS\[PaymentProvider\.PAYSTACK\]/,
    );
    expect(memberCheckout).not.toMatch(
      /PaymentProvider\.HUBTEL\) \{\s*return "Online"/,
    );
  });

  it("preserves admin manual contribution routes and Paystack recovery tooling", () => {
    const adminNew = readSrc("app/admin/contributions/new/page.tsx");
    const recover = readSrc(
      "components/admin/recover-unsettled-payment-button.tsx",
    );
    const reconciliation = readSrc(
      "components/admin/reconciliation-overview.tsx",
    );

    expect(adminNew.length).toBeGreaterThan(0);
    expect(recover).toContain("Paystack");
    expect(reconciliation).toContain("Unsettled Paystack Successes");
  });

  it("preserves receipt download entry points for members", () => {
    const receipts = readSrc("components/member/receipt-download-button.tsx");
    expect(receipts).toContain("download");
  });

  it("documents that callback rate limiting needs durable infra", () => {
    const callback = readSrc("app/api/payments/callback/route.ts");
    expect(callback).toContain("no durable shared store");
    expect(callback).toContain("rate limiting");
  });
});
