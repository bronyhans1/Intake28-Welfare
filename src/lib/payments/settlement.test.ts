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

function makeVerifyResponse(
  overrides: Partial<{
    status: PaymentStatus;
    providerReference: string;
    amount: number;
    requestedAmount: number | null;
    fees: number | null;
    currency: string;
    paidAt: Date | null;
  }> = {},
) {
  return {
    status: PaymentStatus.SUCCESS,
    providerReference: reference,
    amount: 5000,
    requestedAmount: 5000,
    fees: 0,
    currency: "GHS",
    paidAt: new Date("2026-06-17T11:00:00.000Z"),
    ...overrides,
  };
}

function mockSuccessfulSettlement(
  paymentOverrides: Partial<SerializedPayment> = {},
  verifyOverrides: Parameters<typeof makeVerifyResponse>[0] = {},
) {
  mockGetPaymentByReference.mockResolvedValue(makePayment(paymentOverrides));
  mockPaystackVerify.mockResolvedValue(makeVerifyResponse(verifyOverrides));
  mockUpdatePaymentStatus.mockResolvedValue(
    makePayment({ status: PaymentStatus.SUCCESS, ...paymentOverrides }),
  );
}

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

  it("C. rejects underpaid Paystack business amount via requested_amount", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
    mockPaystackVerify.mockResolvedValue(
      makeVerifyResponse({
        amount: 4999,
        requestedAmount: 4999,
        fees: 0,
      }),
    );

    await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
      PaymentSettlementError,
    );
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  describe("Paystack business amount validation", () => {
    it("TEST 1. accepts exact business amount with no fee gross-up", async () => {
      mockSuccessfulSettlement(
        { amount: 50 },
        { amount: 5000, requestedAmount: 5000, fees: 0 },
      );

      await expect(
        settlePaymentFromPaystackReference(reference),
      ).resolves.toMatchObject({ outcome: "settled" });
    });

    it("TEST 2. accepts customer fee gross-up (production Mobile Money scenario)", async () => {
      mockSuccessfulSettlement(
        { amount: 50 },
        { amount: 5100, requestedAmount: 5000, fees: 100 },
      );

      const result = await settlePaymentFromPaystackReference(reference, {
        source: "webhook",
      });

      expect(result.outcome).toBe("settled");
      expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            amount: 50,
            paystackAmount: 5100,
            paystackRequestedAmount: 5000,
            paystackFees: 100,
            paystackBusinessAmount: 5000,
          }),
        }),
      );
    });

    it("TEST 3. rejects underpaid requested_amount", async () => {
      mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
      mockPaystackVerify.mockResolvedValue(
        makeVerifyResponse({
          amount: 4999,
          requestedAmount: 4999,
          fees: 0,
        }),
      );

      await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
        PaymentSettlementError,
      );
      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("TEST 4. accepts derived business amount when requested_amount is missing", async () => {
      mockSuccessfulSettlement(
        { amount: 50 },
        { amount: 5100, requestedAmount: null, fees: 100 },
      );

      await expect(
        settlePaymentFromPaystackReference(reference),
      ).resolves.toMatchObject({ outcome: "settled" });
    });

    it("TEST 5. rejects derived business amount that does not match expected", async () => {
      mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
      mockPaystackVerify.mockResolvedValue(
        makeVerifyResponse({
          amount: 5100,
          requestedAmount: null,
          fees: 50,
        }),
      );

      await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
        PaymentSettlementError,
      );
      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("TEST 6. still rejects wrong currency with fee gross-up", async () => {
      mockGetPaymentByReference.mockResolvedValue(makePayment({ amount: 50 }));
      mockPaystackVerify.mockResolvedValue(
        makeVerifyResponse({
          amount: 5100,
          requestedAmount: 5000,
          fees: 100,
          currency: "NGN",
        }),
      );

      await expect(settlePaymentFromPaystackReference(reference)).rejects.toThrow(
        "Paystack currency does not match the expected payment currency.",
      );
      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("TEST 8. repeated settlement after SUCCESS remains idempotent", async () => {
      const successPayment = makePayment({
        status: PaymentStatus.SUCCESS,
        providerReference: reference,
      });
      mockGetPaymentByReference.mockResolvedValue(successPayment);

      const first = await settlePaymentFromPaystackReference(reference, {
        source: "webhook",
      });
      const second = await settlePaymentFromPaystackReference(reference, {
        source: "callback",
      });

      expect(first.outcome).toBe("already_settled");
      expect(second.outcome).toBe("already_settled");
      expect(mockPaystackVerify).not.toHaveBeenCalled();
      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("TEST 9. concurrent callback and webhook settlement accept fee gross-up", async () => {
      mockSuccessfulSettlement(
        { amount: 50 },
        { amount: 5100, requestedAmount: 5000, fees: 100 },
      );

      const [callbackResult, webhookResult] = await Promise.all([
        settlePaymentFromPaystackReference(reference, { source: "callback" }),
        settlePaymentFromPaystackReference(reference, { source: "webhook" }),
      ]);

      expect(callbackResult.outcome).toBe("settled");
      expect(webhookResult.outcome).toBe("settled");
      expect(mockEnsureContributionFromPayment).toHaveBeenCalled();
    });
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

  it("marks Paystack verify request failures as retryable settlement errors", async () => {
    const { PaystackRequestError } = await import("@/lib/integrations/paystack/client");
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockPaystackVerify.mockRejectedValue(
      new PaystackRequestError("Failed to verify Paystack payment."),
    );

    await expect(settlePaymentFromPaystackReference(reference)).rejects.toMatchObject({
      name: "PaymentSettlementError",
      message: "Failed to verify Paystack payment.",
      retryable: true,
    });
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
  const mockCreateAuditLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFirebaseConfigured.mockReturnValue(true);
    mockVerifySignature.mockReturnValue(true);
    mockCreateAuditLog.mockResolvedValue("audit-1");
    mockSettle.mockResolvedValue({
      outcome: "settled",
      payment: makePayment({ status: PaymentStatus.SUCCESS }),
      message: "Payment settled successfully.",
    });
  });

  async function loadRoutes() {
    vi.doMock("@/lib/payments/settlement", () => ({
      PaymentSettlementError,
      PAYSTACK_SETTLEMENT_ACTOR: {
        uid: "paystack-automation",
        fullName: "Paystack Automation",
        serviceNumber: "SYSTEM",
        role: UserRole.ADMIN,
        profileCompleted: true,
        profileCompletionPercentage: 100,
      },
      settlePaymentFromPaystackReference: (...args: unknown[]) => mockSettle(...args),
    }));
    vi.doMock("@/lib/integrations/paystack/webhook-signature", () => ({
      verifyPaystackWebhookSignature: (...args: unknown[]) =>
        mockVerifySignature(...args),
    }));
    vi.doMock("@/lib/firebase/admin", () => ({
      isFirebaseAdminConfigured: () => mockFirebaseConfigured(),
    }));
    vi.doMock("@/lib/audit/repository", () => ({
      createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
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

  function webhookRequest(body: string, signature = "valid") {
    return new Request("http://localhost:3000/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": signature,
      },
      body,
    });
  }

  it("J. callback route uses shared settlement", async () => {
    const { callback } = await loadRoutes();

    const response = await callback.GET(
      new Request("http://localhost:3000/api/payments/callback?reference=GIS-TEST"),
    );

    expect(response.status).toBe(307);
    expect(mockSettle).toHaveBeenCalledWith("GIS-TEST", { source: "callback" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/payments?verified=1");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_CALLBACK_OUTCOME,
        metadata: expect.objectContaining({ category: "settled" }),
      }),
    );
  });

  it("N. duplicate webhook delivery is safe", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference, status: "success", amount: 5000, currency: "GHS" },
    });

    mockSettle
      .mockResolvedValueOnce({
        outcome: "settled",
        payment: makePayment({ status: PaymentStatus.SUCCESS }),
      })
      .mockResolvedValueOnce({
        outcome: "already_settled",
        payment: makePayment({ status: PaymentStatus.SUCCESS }),
      });

    const first = await webhook.POST(webhookRequest(body));
    const second = await webhook.POST(webhookRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockSettle).toHaveBeenCalledTimes(2);
    const secondBody = await second.json();
    expect(secondBody.category).toBe("already_settled");
  });

  it("Q. charge.failed webhook does not call settlement", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({
      event: "charge.failed",
      data: { reference, status: "failed" },
    });

    const response = await webhook.POST(webhookRequest(body));

    expect(response.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_WEBHOOK_OUTCOME,
        metadata: expect.objectContaining({ category: "charge_failed_ignored" }),
      }),
    );
  });

  it("R. unsupported webhook event does not settle payment", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "transfer.success", data: {} });

    const response = await webhook.POST(webhookRequest(body));

    expect(response.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("webhook invalid signature returns 401", async () => {
    mockVerifySignature.mockReturnValue(false);
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    const response = await webhook.POST(webhookRequest(body, "bad"));

    expect(response.status).toBe(401);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("webhook permanent validation failure returns 200 skipped", async () => {
    mockSettle.mockRejectedValue(new PaymentSettlementError("Payment not found."));
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({
      event: "charge.success",
      data: { reference },
    });

    const response = await webhook.POST(webhookRequest(body));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.skipped).toBe(true);
    expect(payload.category).toBe("payment_not_found");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_WEBHOOK_OUTCOME,
        metadata: expect.objectContaining({
          category: "payment_not_found",
          outcome: "rejected_permanent",
        }),
      }),
    );
    expect(JSON.stringify(mockCreateAuditLog.mock.calls)).not.toMatch(/sk_test|signature|secret/i);
  });

  it("webhook amount mismatch returns permanent 200 acknowledgement", async () => {
    mockSettle.mockRejectedValue(
      new PaymentSettlementError(
        "Paystack amount does not match the expected payment amount.",
      ),
    );
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    const response = await webhook.POST(webhookRequest(body));
    expect(response.status).toBe(200);
    expect((await response.json()).category).toBe("amount_mismatch");
  });

  it("webhook retryable verify failure returns 503", async () => {
    mockSettle.mockRejectedValue(
      new PaymentSettlementError("Failed to verify Paystack payment.", {
        retryable: true,
      }),
    );
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    const response = await webhook.POST(webhookRequest(body));
    expect(response.status).toBe(503);
    expect((await response.json()).category).toBe("paystack_verify_unavailable");
  });

  it("webhook post-success recording failure returns 500 for retry/heal", async () => {
    mockSettle.mockRejectedValue(new Error("contribution write failed"));
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    const response = await webhook.POST(webhookRequest(body));
    expect(response.status).toBe(500);
    expect((await response.json()).category).toBe("post_success_recording_error");
  });

  it("webhook malformed JSON returns 400", async () => {
    const { webhook } = await loadRoutes();
    const response = await webhook.POST(webhookRequest("{not-json"));
    expect(response.status).toBe(400);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("webhook missing reference returns 400", async () => {
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: {} });
    const response = await webhook.POST(webhookRequest(body));
    expect(response.status).toBe(400);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("webhook non-success verify outcome is acknowledged with 200", async () => {
    mockSettle.mockResolvedValue({
      outcome: "failed",
      payment: makePayment({ status: PaymentStatus.FAILED }),
      message: "Paystack reported status: failed.",
    });
    const { webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });
    const response = await webhook.POST(webhookRequest(body));
    expect(response.status).toBe(200);
    expect((await response.json()).category).toBe("non_success_status");
  });

  it("callback permanent rejection redirects without exposing internals", async () => {
    mockSettle.mockRejectedValue(
      new PaymentSettlementError(
        "Paystack currency does not match the expected payment currency.",
      ),
    );
    const { callback } = await loadRoutes();
    const response = await callback.GET(
      new Request(`http://localhost:3000/api/payments/callback?reference=${reference}`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/payments?error=verification_failed",
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_CALLBACK_OUTCOME,
        metadata: expect.objectContaining({ category: "currency_mismatch" }),
      }),
    );
  });

  it("concurrent callback and webhook remain safe with hardened ingest", async () => {
    mockSettle
      .mockResolvedValueOnce({
        outcome: "settled",
        payment: makePayment({ status: PaymentStatus.SUCCESS }),
      })
      .mockResolvedValueOnce({
        outcome: "already_settled",
        payment: makePayment({ status: PaymentStatus.SUCCESS }),
      });
    const { callback, webhook } = await loadRoutes();
    const body = JSON.stringify({ event: "charge.success", data: { reference } });

    const [webhookResponse, callbackResponse] = await Promise.all([
      webhook.POST(webhookRequest(body)),
      callback.GET(
        new Request(`http://localhost:3000/api/payments/callback?reference=${reference}`),
      ),
    ]);

    expect(webhookResponse.status).toBe(200);
    expect(callbackResponse.status).toBe(307);
    expect(mockSettle).toHaveBeenCalledTimes(2);
  });
});
