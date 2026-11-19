import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureReceiptFromPayment } from "@/lib/receipts/service";
import {
  ContributionStatus,
  ContributionType,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";
import { ReceiptStatus } from "@/types/receipt";

const mockCreateReceipt = vi.fn();
const mockLogReceiptGeneratedAudit = vi.fn();
const mockEmitReceiptNotificationEvent = vi.fn();

vi.mock("@/lib/receipts/repository", () => ({
  createReceipt: (...args: unknown[]) => mockCreateReceipt(...args),
  logReceiptGeneratedAudit: (...args: unknown[]) =>
    mockLogReceiptGeneratedAudit(...args),
}));

vi.mock("@/lib/receipts/events", () => ({
  emitReceiptNotificationEvent: (...args: unknown[]) =>
    mockEmitReceiptNotificationEvent(...args),
}));

const actor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const payment = {
  id: "payment-1",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/00002",
  email: "IS00002@gis28welfare.org",
  amount: 50,
  currency: "GHS" as const,
  reference: "GIS-20260618-AB1234",
  paymentType: PaymentType.MONTHLY_DUES,
  provider: PaymentProvider.PAYSTACK,
  providerReference: "provider-ref",
  status: PaymentStatus.SUCCESS,
  createdAt: "2026-06-18T10:00:00.000Z",
  updatedAt: "2026-06-18T10:05:00.000Z",
  paidAt: "2026-06-18T10:05:00.000Z",
};

const contribution = {
  id: "contribution-1",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/00002",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  month: 6,
  year: 2026,
  status: ContributionStatus.PAID,
  remarks: null,
  recordedBy: "paystack-automation",
  recordedByName: "Paystack Automation",
  contributionMonth: 6,
  contributionYear: 2026,
  source: "paystack",
  paymentReference: "GIS-20260618-AB1234",
  paymentId: "payment-1",
  createdAt: "2026-06-18T10:05:01.000Z",
  updatedAt: "2026-06-18T10:05:01.000Z",
};

const receipt = {
  id: "GIS-20260618-AB1234",
  receiptNumber: "GIS-RCP-20260618-AB1234",
  paymentId: "payment-1",
  paymentReference: "GIS-20260618-AB1234",
  contributionId: "contribution-1",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/00002",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  currency: "GHS" as const,
  status: ReceiptStatus.ISSUED,
  issuedAt: "2026-06-18T10:05:02.000Z",
  issuedBy: "admin-1",
  createdAt: "2026-06-18T10:05:02.000Z",
};

describe("ensureReceiptFromPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateReceipt.mockResolvedValue({ receipt, created: true });
    mockLogReceiptGeneratedAudit.mockResolvedValue(undefined);
    mockEmitReceiptNotificationEvent.mockResolvedValue(undefined);
  });

  it("creates a receipt for a successful contribution", async () => {
    const result = await ensureReceiptFromPayment(payment, contribution, actor);

    expect(result.outcome).toBe("created");
    expect(result.receipt?.receiptNumber).toBe("GIS-RCP-20260618-AB1234");
    expect(mockCreateReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-1",
        paymentReference: "GIS-20260618-AB1234",
        contributionId: "contribution-1",
        memberId: "member-1",
      }),
    );
    expect(mockLogReceiptGeneratedAudit).toHaveBeenCalledWith(receipt, actor);
    expect(mockEmitReceiptNotificationEvent).toHaveBeenCalled();
  });

  it("returns existing receipt without duplicate audit or notifications", async () => {
    mockCreateReceipt.mockResolvedValue({ receipt, created: false });

    const result = await ensureReceiptFromPayment(payment, contribution, actor);

    expect(result.outcome).toBe("existing");
    expect(result.receipt?.paymentReference).toBe("GIS-20260618-AB1234");
    expect(mockLogReceiptGeneratedAudit).not.toHaveBeenCalled();
    expect(mockEmitReceiptNotificationEvent).not.toHaveBeenCalled();
  });
});
