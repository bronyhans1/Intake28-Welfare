import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  settlePaymentByReference,
  settlePaymentFromHubtelReference,
  settlePaymentFromPaystackReference,
  PaymentSettlementError,
} from "@/lib/payments/settlement";
import { PaymentProvider, PaymentStatus, PaymentType, UserRole } from "@/types/enums";
import type { SerializedPayment } from "@/types/payment";

const mockGetPaymentByReference = vi.fn();
const mockUpdatePaymentStatus = vi.fn();
const mockClaimSuccess = vi.fn();
const mockClaimFailed = vi.fn();
const mockHubtelStatus = vi.fn();
const mockPaystackVerify = vi.fn();
const mockEnsureContributionFromPayment = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockAbandonStale = vi.fn();
const mockPersistNoRecord = vi.fn();
const mockClearNoRecord = vi.fn();

vi.mock("@/lib/payments/repository", () => ({
  getPaymentByReference: (...args: unknown[]) => mockGetPaymentByReference(...args),
  updatePaymentStatus: (...args: unknown[]) => mockUpdatePaymentStatus(...args),
  claimPaymentSuccessTransition: (...args: unknown[]) => mockClaimSuccess(...args),
  claimPaymentFailedTransition: (...args: unknown[]) => mockClaimFailed(...args),
}));

vi.mock("@/lib/integrations/hubtel/status", () => ({
  hubtelFetchTransactionStatus: (...args: unknown[]) => mockHubtelStatus(...args),
  HubtelStatusRequestError: class HubtelStatusRequestError extends Error {
    retryable: boolean;
    kind: string | null;
    responseCode: string | null;
    httpStatus: number | null;
    constructor(
      message: string,
      options?: {
        retryable?: boolean;
        kind?: string | null;
        responseCode?: string | null;
        httpStatus?: number | null;
      },
    ) {
      super(message);
      this.name = "HubtelStatusRequestError";
      this.retryable = options?.retryable ?? true;
      this.kind = options?.kind ?? null;
      this.responseCode = options?.responseCode ?? null;
      this.httpStatus = options?.httpStatus ?? null;
    }
  },
  isHubtelNoRecordStatusError: (error: unknown) =>
    Boolean(
      error &&
        typeof error === "object" &&
        (error as { name?: string; kind?: string }).name ===
          "HubtelStatusRequestError" &&
        (error as { kind?: string }).kind === "no_record",
    ),
}));

vi.mock("@/lib/payments/hubtel-no-record", () => ({
  persistHubtelNoRecordFromStatusError: (...args: unknown[]) =>
    mockPersistNoRecord(...args),
  clearHubtelNoRecordLookup: (...args: unknown[]) => mockClearNoRecord(...args),
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

const reference = "GIS-20261027-AB12CD";

function makeHubtelPayment(
  overrides: Partial<SerializedPayment> = {},
): SerializedPayment {
  return {
    id: "payment-h1",
    memberId: "member-1",
    memberName: "Member User",
    serviceNumber: "IS/00002",
    email: "IS00002@gis28welfare.org",
    amount: 50,
    currency: "GHS",
    reference,
    paymentType: PaymentType.MONTHLY_DUES,
    paymentCategory: "contribution",
    provider: PaymentProvider.HUBTEL,
    providerReference: null,
    status: PaymentStatus.PENDING,
    paidAt: null,
    createdAt: "2026-10-27T10:00:00.000Z",
    updatedAt: "2026-10-27T10:00:00.000Z",
    ...overrides,
  } as SerializedPayment;
}

describe("Hubtel settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbandonStale.mockResolvedValue(0);
    mockEnsureContributionFromPayment.mockResolvedValue({
      outcome: "created",
      contribution: null,
    });
    mockCreateAuditLog.mockResolvedValue("audit-1");
    mockPersistNoRecord.mockResolvedValue(undefined);
    mockClearNoRecord.mockResolvedValue(undefined);
  });

  it("does not settle or change status on Hubtel no-record (4720)", async () => {
    const { HubtelStatusRequestError } = await import("@/lib/integrations/hubtel/status");
    const pending = makeHubtelPayment({ checkoutAmount: 51, processingFeeAmount: 1 });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError(
        "Your status check did not match any records or your reference is older than a month",
        {
          retryable: false,
          kind: "no_record",
          responseCode: "4720",
          httpStatus: 400,
        },
      ),
    );

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toBeInstanceOf(
      PaymentSettlementError,
    );

    expect(mockClaimSuccess).not.toHaveBeenCalled();
    expect(mockClaimFailed).not.toHaveBeenCalled();
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
    expect(mockPersistNoRecord).toHaveBeenCalledTimes(1);
    expect(mockClearNoRecord).not.toHaveBeenCalled();
  });

  it("settles a Paid Hubtel transaction with checkoutAmount and runs contribution automation", async () => {
    const pending = makeHubtelPayment({
      checkoutAmount: 50,
      processingFeeAmount: 0,
    });
    const success = makeHubtelPayment({
      status: PaymentStatus.SUCCESS,
      providerReference: "txn_1",
      checkoutAmount: 50,
      processingFeeAmount: 0,
    });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 50,
      currency: "GHS",
      paidAt: new Date("2026-10-27T12:00:00.000Z"),
      rawStatus: "Paid",
    });
    mockClaimSuccess.mockResolvedValue({ outcome: "claimed", payment: success });

    const result = await settlePaymentFromHubtelReference(reference, {
      source: "callback",
    });

    expect(result.outcome).toBe("settled");
    expect(mockClearNoRecord).toHaveBeenCalledWith(reference);
    expect(mockPaystackVerify).not.toHaveBeenCalled();
    expect(mockClaimSuccess).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({ providerReference: "txn_1" }),
    );
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_VERIFIED,
        metadata: expect.objectContaining({
          provider: PaymentProvider.HUBTEL,
          amount: 50,
          checkoutAmount: 50,
          processingFeeAmount: 0,
          providerReference: "txn_1",
          hubtelAmount: 50,
          settlementSource: "callback",
        }),
      }),
    );
  });

  it("keeps Unpaid as pending without inventing failure", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.PENDING,
      lifecycleStatus: "Unpaid",
      clientReference: reference,
      providerReference: reference,
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Unpaid",
    });

    const result = await settlePaymentFromHubtelReference(reference, {
      source: "callback",
    });

    expect(result.outcome).toBe("pending");
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  it("marks Refunded as failed without creating contributions", async () => {
    const pending = makeHubtelPayment();
    const failed = makeHubtelPayment({ status: PaymentStatus.FAILED });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.FAILED,
      lifecycleStatus: "Refunded",
      clientReference: reference,
      providerReference: "txn_refund",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Refunded",
    });
    mockClaimFailed.mockResolvedValue(failed);

    const result = await settlePaymentFromHubtelReference(reference);
    expect(result.outcome).toBe("failed");
    expect(mockClaimFailed).toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  it("rejects amount mismatches", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 40,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /amount/i,
    );
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it("rejects reference mismatches", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: "GIS-OTHER-REF0001",
      providerReference: "txn_1",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /clientReference/i,
    );
  });

  it("treats Hubtel status timeouts as retryable settlement errors", async () => {
    const { HubtelStatusRequestError } = await import(
      "@/lib/integrations/hubtel/status"
    );
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError("Unable to reach Hubtel", { retryable: true }),
    );

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toMatchObject({
      name: "PaymentSettlementError",
      retryable: true,
    });
    expect(mockClaimSuccess).not.toHaveBeenCalled();
    expect(mockClaimFailed).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("marks Failed lifecycle as failed without inventing success", async () => {
    const pending = makeHubtelPayment();
    const failed = makeHubtelPayment({ status: PaymentStatus.FAILED });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.FAILED,
      lifecycleStatus: "Failed",
      clientReference: reference,
      providerReference: "txn_failed",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Failed",
    });
    mockClaimFailed.mockResolvedValue(failed);

    const result = await settlePaymentFromHubtelReference(reference);
    expect(result.outcome).toBe("failed");
    expect(mockClaimFailed).toHaveBeenCalled();
    expect(mockClaimSuccess).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  it("rejects Paid Hubtel responses with mismatched currency", async () => {
    mockGetPaymentByReference.mockResolvedValue(
      makeHubtelPayment({ checkoutAmount: 50, processingFeeAmount: 0 }),
    );
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 50,
      currency: "USD",
      paidAt: null,
      rawStatus: "Paid",
    });

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /currency/i,
    );
    expect(mockClaimSuccess).not.toHaveBeenCalled();
  });

  it("is idempotent for already settled payments and concurrent heal retries", async () => {
    const success = makeHubtelPayment({
      status: PaymentStatus.SUCCESS,
      providerReference: "txn_1",
    });
    mockGetPaymentByReference.mockResolvedValue(success);

    const [first, second] = await Promise.all([
      settlePaymentFromHubtelReference(reference, { source: "callback" }),
      settlePaymentFromHubtelReference(reference, { source: "verify" }),
    ]);

    expect(first.outcome).toBe("already_settled");
    expect(second.outcome).toBe("already_settled");
    expect(mockHubtelStatus).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(2);
  });

  it("handles concurrent first-time settlements with a single SUCCESS claim winner", async () => {
    const pending = makeHubtelPayment();
    const success = makeHubtelPayment({
      status: PaymentStatus.SUCCESS,
      providerReference: "txn_1",
    });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    mockClaimSuccess
      .mockResolvedValueOnce({ outcome: "claimed", payment: success })
      .mockResolvedValueOnce({ outcome: "already_settled", payment: success });

    const [a, b] = await Promise.all([
      settlePaymentFromHubtelReference(reference, { source: "callback" }),
      settlePaymentFromHubtelReference(reference, { source: "verify" }),
    ]);

    expect([a.outcome, b.outcome].sort()).toEqual(
      ["already_settled", "settled"].sort(),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledTimes(2);
  });

  it("rejects Paid responses missing amount", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: null,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /missing a transaction amount/i,
    );
    expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
  });

  it("settles legacy Hubtel payments without checkoutAmount when status matches amount", async () => {
    const pending = makeHubtelPayment();
    const success = makeHubtelPayment({
      status: PaymentStatus.SUCCESS,
      providerReference: "txn_legacy",
    });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_legacy",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    mockClaimSuccess.mockResolvedValue({ outcome: "claimed", payment: success });

    const result = await settlePaymentFromHubtelReference(reference);
    expect(result.outcome).toBe("settled");
  });

  it("rejects legacy Hubtel payments when status amount differs from official amount", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 51,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });

    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /amount/i,
    );
    expect(mockClaimSuccess).not.toHaveBeenCalled();
  });

  it("settles GH₵51 verified Hubtel amount while crediting official GH₵50", async () => {
    const pending = makeHubtelPayment({
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
    });
    const success = makeHubtelPayment({
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
      status: PaymentStatus.SUCCESS,
      providerReference: "txn_fee_fixture",
    });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_fee_fixture",
      amount: 51,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    mockClaimSuccess.mockResolvedValue({ outcome: "claimed", payment: success });

    const result = await settlePaymentFromHubtelReference(reference);
    expect(result.outcome).toBe("settled");
    expect(mockClaimSuccess).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({ providerReference: "txn_fee_fixture" }),
    );
    expect(mockClaimSuccess.mock.calls[0][1]).not.toHaveProperty("amount");
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, checkoutAmount: 51 }),
      expect.anything(),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          amount: 50,
          checkoutAmount: 51,
          processingFeeAmount: 1,
          hubtelAmount: 51,
          providerReference: "txn_fee_fixture",
        }),
      }),
    );
  });

  it("rejects underpaid and overpaid status amounts when checkoutAmount is stored", async () => {
    const pending = makeHubtelPayment({
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
    });
    mockGetPaymentByReference.mockResolvedValue(pending);

    mockHubtelStatus.mockResolvedValueOnce({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_under",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /amount/i,
    );

    mockHubtelStatus.mockResolvedValueOnce({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_over",
      amount: 52,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    await expect(settlePaymentFromHubtelReference(reference)).rejects.toThrow(
      /amount/i,
    );

    expect(mockClaimSuccess).not.toHaveBeenCalled();
    expect(mockEnsureContributionFromPayment).not.toHaveBeenCalled();
  });

  it("routes Hubtel through Hubtel settle and never Paystack verify", async () => {
    const pending = makeHubtelPayment();
    const success = makeHubtelPayment({ status: PaymentStatus.SUCCESS });
    mockGetPaymentByReference.mockResolvedValue(pending);
    mockHubtelStatus.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: "txn_1",
      amount: 50,
      currency: "GHS",
      paidAt: null,
      rawStatus: "Paid",
    });
    mockClaimSuccess.mockResolvedValue({ outcome: "claimed", payment: success });

    await settlePaymentByReference(reference, { source: "verify" });
    expect(mockHubtelStatus).toHaveBeenCalled();
    expect(mockPaystackVerify).not.toHaveBeenCalled();
  });

  it("refuses to send Hubtel references into Paystack settlement", async () => {
    mockGetPaymentByReference.mockResolvedValue(makeHubtelPayment());
    await expect(
      settlePaymentFromPaystackReference(reference),
    ).rejects.toThrow(/must not be verified through Paystack/);
    expect(mockPaystackVerify).not.toHaveBeenCalled();
  });

  it("preserves historical Paystack settlement via provider routing", async () => {
    const paystackPending = makeHubtelPayment({
      provider: PaymentProvider.PAYSTACK,
    });
    const paystackSuccess = makeHubtelPayment({
      provider: PaymentProvider.PAYSTACK,
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
    });
    mockGetPaymentByReference.mockResolvedValue(paystackPending);
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: reference,
      amount: 5000,
      requestedAmount: 5000,
      fees: 0,
      currency: "GHS",
      paidAt: new Date("2026-10-27T12:00:00.000Z"),
    });
    mockClaimSuccess.mockResolvedValue({
      outcome: "claimed",
      payment: paystackSuccess,
    });

    const result = await settlePaymentByReference(reference, {
      source: "recovery",
      actor: {
        uid: "admin-1",
        fullName: "Admin",
        role: UserRole.ADMIN,
        serviceNumber: "IS/00001",
        profileCompleted: true,
        profileCompletionPercentage: 100,
      },
    });

    expect(result.outcome).toBe("settled");
    expect(mockPaystackVerify).toHaveBeenCalledWith(reference);
    expect(mockHubtelStatus).not.toHaveBeenCalled();
    expect(mockClaimSuccess).toHaveBeenCalled();
  });

  it("rejects missing payments for unauthorized/unknown references", async () => {
    mockGetPaymentByReference.mockResolvedValue(null);
    await expect(settlePaymentByReference("GIS-MISSING-XXXXXX")).rejects.toBeInstanceOf(
      PaymentSettlementError,
    );
  });
});
