import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  assessMonthlyDuesRecoveryConflict,
  recoverUnsettledPaystackPayment,
} from "@/lib/finance/recover-unsettled-payment";
import { PaymentSettlementError } from "@/lib/payments/settlement";
import {
  ContributionStatus,
  ContributionType,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";
import type { SerializedPayment } from "@/types/payment";
import type { CurrentUser } from "@/types/auth";

const mockGetPaymentByReference = vi.fn();
const mockSettle = vi.fn();
const mockFindPaid = vi.fn();
const mockListContributions = vi.fn();
const mockGetReceipt = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/payments/repository", () => ({
  getPaymentByReference: (...args: unknown[]) => mockGetPaymentByReference(...args),
}));

vi.mock("@/lib/payments/settlement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/settlement")>(
    "@/lib/payments/settlement",
  );
  return {
    ...actual,
    settlePaymentFromPaystackReference: (...args: unknown[]) => mockSettle(...args),
  };
});

vi.mock("@/lib/contributions/repository", () => ({
  findPaidMonthlyDuesContribution: (...args: unknown[]) => mockFindPaid(...args),
  listContributionsByPaymentReference: (...args: unknown[]) =>
    mockListContributions(...args),
}));

vi.mock("@/lib/receipts/repository", () => ({
  getReceiptByPaymentReference: (...args: unknown[]) => mockGetReceipt(...args),
}));

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

const reference = "GIS-RECOVER-001";

function makePayment(overrides: Partial<SerializedPayment> = {}): SerializedPayment {
  return {
    id: "payment-1",
    memberId: "member-1",
    memberName: "Member User",
    serviceNumber: "IS/12003",
    email: "member@example.com",
    amount: 50,
    currency: "GHS",
    reference,
    paymentType: PaymentType.MONTHLY_DUES,
    paymentCategory: "dues",
    provider: "paystack",
    providerReference: null,
    status: PaymentStatus.ABANDONED,
    selectedMonths: [{ month: 10, year: 2026 }],
    paidAt: null,
    createdAt: "2026-10-07T18:56:06.755Z",
    updatedAt: "2026-10-08T18:56:06.755Z",
    ...overrides,
  } as SerializedPayment;
}

const adminActor: CurrentUser = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const treasurerActor: CurrentUser = {
  ...adminActor,
  uid: "treasurer-1",
  role: UserRole.TREASURER,
  serviceNumber: "IS/00002",
};

const memberActor: CurrentUser = {
  ...adminActor,
  uid: "member-1",
  role: UserRole.MEMBER,
  serviceNumber: "IS/12003",
};

describe("recoverUnsettledPaystackPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindPaid.mockResolvedValue(null);
    mockListContributions.mockResolvedValue([]);
    mockGetReceipt.mockResolvedValue(null);
    mockCreateAuditLog.mockResolvedValue("audit-1");
  });

  it("recovers an eligible abandoned payment through shared settlement", async () => {
    const payment = makePayment();
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockSettle.mockResolvedValue({
      outcome: "settled",
      payment: { ...payment, status: PaymentStatus.SUCCESS },
      message: "Payment settled successfully.",
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);

    expect(result.outcome).toBe("recovered");
    expect(mockSettle).toHaveBeenCalledWith(reference, {
      actor: adminActor,
      source: "recovery",
    });
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_RECOVERY,
        entityId: reference,
        metadata: expect.objectContaining({ outcome: "recovered" }),
      }),
    );
  });

  it("allows treasurer recovery", async () => {
    const payment = makePayment();
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockSettle.mockResolvedValue({
      outcome: "settled",
      payment: { ...payment, status: PaymentStatus.SUCCESS },
    });

    const result = await recoverUnsettledPaystackPayment(reference, treasurerActor);
    expect(result.outcome).toBe("recovered");
  });

  it("rejects unauthorized members", async () => {
    const result = await recoverUnsettledPaystackPayment(reference, memberActor);
    expect(result.outcome).toBe("unauthorized");
    expect(mockSettle).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ outcome: "unauthorized" }),
      }),
    );
  });

  it("maps Paystack settlement verification errors", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockSettle.mockRejectedValue(new PaymentSettlementError("Paystack verification timed out."));

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("verification_failed");
    expect(result.message).toMatch(/timed out/i);
  });

  it("maps non-success Paystack outcomes", async () => {
    const payment = makePayment();
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockSettle.mockResolvedValue({
      outcome: "failed",
      payment: { ...payment, status: PaymentStatus.FAILED },
      message: "Paystack reported status: failed.",
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("verification_failed");
    expect(mockSettle).toHaveBeenCalled();
  });

  it("maps amount mismatch settlement errors", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockSettle.mockRejectedValue(
      new PaymentSettlementError("Paystack amount does not match the expected payment amount."),
    );

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("verification_failed");
    expect(result.message).toMatch(/amount/i);
  });

  it("returns already_settled without re-settling as a new charge", async () => {
    const payment = makePayment({ status: PaymentStatus.SUCCESS });
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockSettle.mockResolvedValue({
      outcome: "already_settled",
      payment,
      message: "Payment was already settled.",
    });
    mockListContributions.mockResolvedValue([
      {
        id: "c1",
        paymentReference: reference,
        status: ContributionStatus.PAID,
        month: 10,
        year: 2026,
      },
    ]);
    mockGetReceipt.mockResolvedValue({ id: reference, paymentReference: reference });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("already_settled");
    expect(mockSettle).toHaveBeenCalledWith(reference, {
      actor: adminActor,
      source: "recovery",
    });
  });

  it("refuses surplus when period is already PAID on another reference", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockFindPaid.mockResolvedValue({
      id: "existing",
      paymentReference: "GIS-OTHER-REF",
      memberId: "member-1",
      month: 10,
      year: 2026,
      status: ContributionStatus.PAID,
      contributionType: ContributionType.MONTHLY_DUES,
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("ineligible_surplus");
    expect(mockSettle).not.toHaveBeenCalled();
    expect(result.message).toContain("GIS-OTHER-REF");
  });

  it("is idempotent for repeated recovery requests", async () => {
    const payment = makePayment();
    mockGetPaymentByReference
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.SUCCESS });
    mockSettle
      .mockResolvedValueOnce({
        outcome: "settled",
        payment: { ...payment, status: PaymentStatus.SUCCESS },
      })
      .mockResolvedValueOnce({
        outcome: "already_settled",
        payment: { ...payment, status: PaymentStatus.SUCCESS },
      });

    const first = await recoverUnsettledPaystackPayment(reference, adminActor);
    const second = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(first.outcome).toBe("recovered");
    expect(second.outcome).toBe("already_settled");
    expect(mockSettle).toHaveBeenCalledTimes(2);
  });

  it("handles concurrent recovery attempts safely", async () => {
    const payment = makePayment();
    mockGetPaymentByReference.mockResolvedValue(payment);
    let settleCalls = 0;
    mockSettle.mockImplementation(async () => {
      settleCalls += 1;
      if (settleCalls === 1) {
        return {
          outcome: "settled",
          payment: { ...payment, status: PaymentStatus.SUCCESS },
        };
      }
      return {
        outcome: "already_settled",
        payment: { ...payment, status: PaymentStatus.SUCCESS },
      };
    });

    const [a, b] = await Promise.all([
      recoverUnsettledPaystackPayment(reference, adminActor),
      recoverUnsettledPaystackPayment(reference, adminActor),
    ]);

    expect([a.outcome, b.outcome].sort()).toEqual(["already_settled", "recovered"].sort());
    expect(mockSettle).toHaveBeenCalledTimes(2);
  });

  it("reports manual review when recording fails after success", async () => {
    const payment = makePayment();
    mockGetPaymentByReference
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({ ...payment, status: PaymentStatus.SUCCESS });
    mockSettle.mockRejectedValue(new Error("contribution write failed"));

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("manual_review");
    expect(result.message).toMatch(/successful/i);
  });

  it("rejects claim payments", async () => {
    mockGetPaymentByReference.mockResolvedValue(
      makePayment({ paymentType: PaymentType.CLAIM_PAYMENT }),
    );
    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("ineligible");
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("heals already-settled payments missing a receipt via shared settlement", async () => {
    const payment = makePayment({ status: PaymentStatus.SUCCESS });
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockListContributions.mockResolvedValue([
      {
        id: "c1",
        paymentReference: reference,
        status: ContributionStatus.PAID,
        month: 10,
        year: 2026,
      },
    ]);
    mockGetReceipt.mockResolvedValue(null);
    mockSettle.mockResolvedValue({
      outcome: "already_settled",
      payment,
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("already_settled");
    expect(mockSettle).toHaveBeenCalledWith(reference, {
      actor: adminActor,
      source: "recovery",
    });
  });

  it("heals already-settled payments missing a contribution via shared settlement", async () => {
    const payment = makePayment({ status: PaymentStatus.SUCCESS });
    mockGetPaymentByReference.mockResolvedValue(payment);
    mockListContributions.mockResolvedValue([]);
    mockGetReceipt.mockResolvedValue({ id: reference, paymentReference: reference });
    mockSettle.mockResolvedValue({
      outcome: "already_settled",
      payment,
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("already_settled");
    expect(mockSettle).toHaveBeenCalled();
  });

  it("never settles surplus duplicates so welfare points cannot double", async () => {
    mockGetPaymentByReference.mockResolvedValue(makePayment());
    mockFindPaid.mockResolvedValue({
      id: "existing",
      paymentReference: "GIS-OTHER-REF",
      memberId: "member-1",
      month: 10,
      year: 2026,
      status: ContributionStatus.PAID,
    });

    const result = await recoverUnsettledPaystackPayment(reference, adminActor);
    expect(result.outcome).toBe("ineligible_surplus");
    expect(mockSettle).not.toHaveBeenCalled();
  });
});

describe("assessMonthlyDuesRecoveryConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects surplus for another reference on the same period", async () => {
    mockFindPaid.mockResolvedValue({
      paymentReference: "GIS-OTHER",
      month: 10,
      year: 2026,
    });
    const result = await assessMonthlyDuesRecoveryConflict(makePayment());
    expect(result).toMatchObject({
      kind: "surplus",
      existingPaymentReference: "GIS-OTHER",
    });
  });

  it("does not treat same-reference paid period as surplus", async () => {
    mockFindPaid.mockResolvedValue({
      paymentReference: reference,
      month: 10,
      year: 2026,
    });
    const result = await assessMonthlyDuesRecoveryConflict(makePayment());
    expect(result).toEqual({ kind: "none" });
  });

  it("flags partial conflicts for manual review", async () => {
    mockFindPaid
      .mockResolvedValueOnce({
        paymentReference: "GIS-OTHER",
        month: 9,
        year: 2026,
      })
      .mockResolvedValueOnce(null);
    const result = await assessMonthlyDuesRecoveryConflict(
      makePayment({
        selectedMonths: [
          { month: 9, year: 2026 },
          { month: 10, year: 2026 },
        ],
      }),
    );
    expect(result.kind).toBe("partial");
  });
});

describe("recovery UI boundaries", () => {
  it("keeps recovery action off surplus and limitation tables", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const overview = readFileSync(
      join(process.cwd(), "src/components/admin/reconciliation-overview.tsx"),
      "utf8",
    );
    const surplusIndex = overview.indexOf("Potential Surplus Or Duplicate Paystack Charges");
    const limitationsIndex = overview.indexOf("Paystack Verification Not Completed");
    const unsettledIndex = overview.indexOf("Unsettled Paystack Successes");
    const recoverImport = overview.indexOf("RecoverUnsettledPaymentButton");
    expect(unsettledIndex).toBeGreaterThan(-1);
    expect(recoverImport).toBeGreaterThan(-1);
    expect(overview.indexOf("<RecoverUnsettledPaymentButton")).toBeGreaterThan(unsettledIndex);
    expect(overview.indexOf("<RecoverUnsettledPaymentButton")).toBeLessThan(surplusIndex);
    expect(overview.slice(surplusIndex, limitationsIndex)).not.toContain(
      "RecoverUnsettledPaymentButton",
    );
    expect(overview.slice(limitationsIndex)).not.toContain("RecoverUnsettledPaymentButton");
  });

  it("keeps recover dialog description free of invalid nested block markup", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/components/admin/recover-unsettled-payment-button.tsx"),
      "utf8",
    );
    expect(source).toContain("AlertDialogDescription");
    expect(source).not.toContain("AlertDialogDescription asChild");
    expect(source).toContain("This will verify the Paystack charge again on the server");
    expect(source).toContain("<dl");
    const descriptionStart = source.indexOf("<AlertDialogDescription>");
    const descriptionEnd = source.indexOf("</AlertDialogDescription>");
    expect(descriptionStart).toBeGreaterThan(-1);
    expect(descriptionEnd).toBeGreaterThan(descriptionStart);
    const descriptionBody = source.slice(descriptionStart, descriptionEnd);
    expect(descriptionBody).not.toContain("<div");
    expect(descriptionBody).not.toContain("<p>");
    expect(descriptionBody).not.toContain("<dl");
  });
});
