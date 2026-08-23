import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  normalizePaystackCurrency,
  toPaystackMinorUnits,
  verifyPaystackWebhookSignature,
} from "@/lib/integrations/paystack/webhook-signature";
import {
  PaymentSettlementError,
  settlePaymentFromPaystackReference,
} from "@/lib/payments/settlement";
import { PaymentStatus, PaymentType, UserRole } from "@/types/enums";
import type { SerializedPayment } from "@/types/payment";

const mockGetPaymentByReference = vi.fn();
const mockUpdatePaymentStatus = vi.fn();
const mockPaystackVerify = vi.fn();
const mockEnsureContributionFromPayment = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockAbandonStale = vi.fn();

vi.mock("@/lib/payments/repository", () => ({
  getPaymentByReference: (...args: unknown[]) => mockGetPaymentByReference(...args),
  updatePaymentStatus: (...args: unknown[]) => mockUpdatePaymentStatus(...args),
}));

vi.mock("@/lib/integrations/paystack/client", () => ({
  paystackVerifyTransaction: (...args: unknown[]) => mockPaystackVerify(...args),
  PaystackRequestError: class PaystackRequestError extends Error {
    name = "PaystackRequestError";
  },
}));

vi.mock("@/lib/payments/contribution-automation", () => ({
  ensureContributionFromPayment: (...args: unknown[]) =>
    mockEnsureContributionFromPayment(...args),
}));

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/payments/lifecycle", () => ({
  abandonStalePendingPayments: (...args: unknown[]) => mockAbandonStale(...args),
}));

vi.mock("@/config/env", () => ({
  env: {
    server: () => ({ PAYSTACK_SECRET_KEY: "sk_test_secret" }),
    client: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
  },
}));

const reference = "GIS-20260617-AB1234";

function makePayment(
  overrides: Partial<SerializedPayment> = {},
): SerializedPayment {
  return {
    id: "payment-1",
    memberId: "member-1",
    memberName: "Member User",
    serviceNumber: "IS/00002",
    email: "IS00002@gis28welfare.org",
    amount: 50,
    currency: "GHS",
    reference,
    paymentType: PaymentType.MONTHLY_DUES,
    paymentCategory: "dues",
    provider: "paystack",
    providerReference: null,
    status: PaymentStatus.PENDING,
    paidAt: null,
    createdAt: "2026-06-17T10:00:00.000Z",
    updatedAt: "2026-06-17T10:00:00.000Z",
    ...overrides,
  } as SerializedPayment;
}

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/00002",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

describe("paystack amount conversion", () => {
  it("converts GHS 50.00 to 5000 pesewas", () => {
    expect(toPaystackMinorUnits(50)).toBe(5000);
  });
});

describe("paystack currency normalization", () => {
  it("compares currencies case-insensitively", () => {
    expect(normalizePaystackCurrency("ghs")).toBe("GHS");
    expect(normalizePaystackCurrency(" GHS ")).toBe("GHS");
  });
});

describe("settlePaymentFromPaystackReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbandonStale.mockResolvedValue(0);
    mockEnsureContributionFromPayment.mockResolvedValue({
      outcome: "created",
      contribution: null,
    });
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  it("A. settles a successful Paystack verification", async () => {
    const pending = makePayment();
    const settled = makePayment({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      paidAt: "2026-06-17T11:00:00.000Z",
    });

    mockGetPaymentByReference.mockResolvedValue(pending);
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(settled);

    const result = await settlePaymentFromPaystackReference(reference, {
      actor: memberActor,
      source: "verify",
    });

    expect(result.outcome).toBe("settled");
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: PaymentAuditAction.PAYMENT_VERIFIED }),
    );
  });

  it("B. accepts the correct Paystack amount", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.SUCCESS }),
    );

    await expect(
      settlePaymentFromPaystackReference(reference),
    ).resolves.toMatchObject({ outcome: "settled" });
  });

  it("C. rejects a wrong Paystack amount", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 4999,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });

    await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
      PaymentSettlementError,
    );
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  it("D. accepts the correct Paystack currency", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment({ currency: "GHS" }));
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "ghs",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.SUCCESS }),
    );

    await expect(
      settlePaymentFromPaystackReference(reference),
    ).resolves.toMatchObject({ outcome: "settled" });
  });

  it("E. rejects a wrong Paystack currency", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment({ currency: "GHS" }));
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "NGN",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });

    await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
      "Paystack currency does not match the expected payment currency.",
    );
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it("F. rejects a mismatched provider reference", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: "GIS-OTHER-REF",
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });

    await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
      "Paystack reference does not match the expected payment reference.",
    );
  });

  it("G. does not downgrade an already SUCCESS payment", async () => {
    const successPayment = makePayment({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      paidAt: "2026-06-17T11:00:00.000Z",
    });
    mockGetPaymentByReference.mockResolvedValue(successPayment);

    const result = await settlePaymentFromPaystackReference(reference);

    expect(result.outcome).toBe("already_settled");
    expect(mockPaystackVerify).not.toHaveBeenCalled();
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it("H. repeated verification does not duplicate contribution automation calls unsafely", async () => {
    const successPayment = makePayment({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
    });
    mockGetPaymentByReference.mockResolvedValue(successPayment);

    await settlePaymentFromPaystackReference(reference);
    await settlePaymentFromPaystackReference(reference);

    expect(mockPaystackVerify).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(2);
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it("I. first settlement creates contribution once per successful path", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.SUCCESS }),
    );

    await settlePaymentFromPaystackReference(reference);

    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(1);
  });

  it("J. webhook source uses shared settlement path", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.SUCCESS }),
    );

    const result = await settlePaymentFromPaystackReference(reference, {
      source: "webhook",
    });

    expect(result.outcome).toBe("settled");
    expect(mockPaystackVerify).toHaveBeenCalledWith(reference);
  });

  it("O. callback and webhook on same reference remain safe after first settlement", async () => {
    const successPayment = makePayment({ status: PaymentStatus.SUCCESS });
    mockGetPaymentByReference.mockResolvedValue(successPayment);

    const callbackResult = await settlePaymentFromPaystackReference(reference, {
      source: "callback",
    });
    const webhookResult = await settlePaymentFromPaystackReference(reference, {
      source: "webhook",
    });

    expect(callbackResult.outcome).toBe("already_settled");
    expect(webhookResult.outcome).toBe("already_settled");
    expect(mockPaystackVerify).not.toHaveBeenCalled();
  });

  it("P. does not trust webhook event status without Paystack verify API", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.SUCCESS }),
    );

    await settlePaymentFromPaystackReference(reference, { source: "webhook" });

    expect(mockPaystackVerify).toHaveBeenCalledWith(reference);
  });

  it("returns pending/failed outcomes for non-success Paystack statuses", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.FAILED,
      providerReference: reference,
      amount: 5000,
      currency: "GHS",
      paidAt: null,
    });
    mockUpdatePaymentStatus.mockResolvedValue(
      makePayment({ status: PaymentStatus.FAILED }),
    );

    const result = await settlePaymentFromPaystackReference(reference);

    expect(result.outcome).toBe("failed");
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });
});

describe("paystack webhook signature", () => {
  function sign(body: string): string {
    return createHmac("sha512", "sk_test_secret").update(body).digest("hex");
  }

  it("K. accepts a valid webhook signature", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    expect(verifyPaystackWebhookSignature(body, sign(body))).toBe(true);
  });

  it("L. rejects an invalid webhook signature", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    expect(verifyPaystackWebhookSignature(body, "invalid-signature")).toBe(false);
  });

  it("M. rejects a missing webhook signature", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    expect(verifyPaystackWebhookSignature(body, null)).toBe(false);
  });
});

describe("payment API routes", () => {
  const mockSettle = vi.fn();
  const mockVerifySignature = vi.fn();
  const mockFirebaseConfigured = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFirebaseConfigured.mockReturnValue(true);
    mockVerifySignature.mockReturnValue(true);
    mockSettle.mockResolvedValue({
      outcome: "settled",
      payment: makePayment({ status: PaymentStatus.SUCCESS }),
    });
  });

  async function loadRoutes() {
    vi.doMock("@/lib/payments/settlement", () => ({
      PaymentSettlementError,
      settlePaymentFromPaystackReference: (...args: unknown[]) => mockSettle(...args),
    }));
    vi.doMock("@/lib/integrations/paystack/webhook-signature", () => ({
      verifyPaystackWebhookSignature: (...args: unknown[]) =>
        mockVerifySignature(...args),
    }));
    vi.doMock("@/lib/firebase/admin", () => ({
      isFirebaseAdminConfigured: () => mockFirebaseConfigured(),
    }));
    vi.doMock("@/config/env", () => ({
      env: {
        client: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
      },
    }));

    const callback = await import("@/app/api/payments/callback/route");
    const webhook = await import("@/app/api/payments/webhook/route");
    return { callback, webhook };
  }

  it("J. callback route uses shared settlement", async () => {
    const { callback } = await loadRoutes();

    const response = await callback.GET(
      new Request("http://localhost:3000/api/payments/callback?reference=GIS-TEST"),
    );

    expect(response.status).toBe(307);
    expect(mockSettle).toHaveBeenCalledWith("GIS-TEST", { source: "callback" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/payments?verified=1");
  });

  it("N. duplicate webhook delivery is safe", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference, status: "success", amount: 5000, currency: "GHS" },
    });

    const request = () =>
      webhook.POST(
        new Request("http://localhost:3000/api/payments/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-paystack-signature": "valid",
          },
          body,
        }),
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockSettle).toHaveBeenCalledTimes(2);
  });

  it("Q. charge.failed webhook does not call settlement", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({
      event: "charge.failed",
      data: { reference, status: "failed" },
    });

    const response = await webhook.POST(
      new Request("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": "valid",
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("R. unsupported webhook event does not settle payment", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "transfer.success", data: {} });

    const response = await webhook.POST(
      new Request("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": "valid",
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("webhook invalid signature returns 401", async () => {
    mockVerifySignature.mockReturnValue(false);
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    const response = await webhook.POST(
      new Request("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": "bad",
        },
        body,
      }),
    );

    expect(response.status).toBe(401);
    expect(mockSettle).not.toHaveBeenCalled();
  });
});
