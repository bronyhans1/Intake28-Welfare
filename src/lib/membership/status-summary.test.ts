import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMemberMembershipStatus } from "@/lib/membership/status-summary";
import { UserRole } from "@/types/enums";

const mockGetMonthlyDuesPaymentGuardStatus = vi.fn();
const mockListContributions = vi.fn();
const mockGetContributionStats = vi.fn();
const mockListPayments = vi.fn();
const mockListWelfareSupport = vi.fn();
const mockGetReceiptStats = vi.fn();

vi.mock("@/lib/payments/monthly-dues-guard", () => ({
  getMonthlyDuesPaymentGuardStatus: (...args: unknown[]) =>
    mockGetMonthlyDuesPaymentGuardStatus(...args),
}));

vi.mock("@/lib/contributions/repository", () => ({
  listContributions: (...args: unknown[]) => mockListContributions(...args),
  getContributionStats: (...args: unknown[]) => mockGetContributionStats(...args),
}));

vi.mock("@/lib/payments/repository", () => ({
  listPayments: (...args: unknown[]) => mockListPayments(...args),
}));

vi.mock("@/lib/welfare/repository", () => ({
  listWelfareSupport: (...args: unknown[]) => mockListWelfareSupport(...args),
}));

vi.mock("@/lib/receipts/repository", () => ({
  getReceiptStats: (...args: unknown[]) => mockGetReceiptStats(...args),
}));

const executiveActor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

describe("getMemberMembershipStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonthlyDuesPaymentGuardStatus.mockResolvedValue({
      isPaid: true,
      message: "Your monthly dues for June 2026 have already been paid.",
      month: 6,
      year: 2026,
    });
    mockListContributions.mockResolvedValue({
      records: [
        {
          id: "contribution-1",
          amount: 50,
          contributionType: "monthly_dues",
          createdAt: "2026-06-18T10:00:00.000Z",
        },
      ],
    });
    mockGetContributionStats.mockResolvedValue({
      totalContributions: 3,
      totalAmountCollected: 150,
      membersContributed: 1,
    });
    mockListPayments.mockResolvedValue({
      total: 3,
      records: [{ paidAt: "2026-06-17T12:00:00.000Z", createdAt: "2026-06-17T11:00:00.000Z" }],
    });
    mockListWelfareSupport.mockResolvedValue({ total: 1, records: [] });
    mockGetReceiptStats.mockResolvedValue({ issuedReceipts: 2, cancelledReceipts: 0 });
  });

  it("scopes membership data to the executive actor uid", async () => {
    const status = await getMemberMembershipStatus("admin-1", executiveActor);

    expect(mockGetMonthlyDuesPaymentGuardStatus).toHaveBeenCalledWith("admin-1");
    expect(mockListContributions).toHaveBeenCalledWith({
      memberId: "admin-1",
      page: 1,
      pageSize: 1,
    });
    expect(mockGetContributionStats).toHaveBeenCalledWith({ memberId: "admin-1" });
    expect(mockListPayments).toHaveBeenCalledWith(
      { page: 1, pageSize: 1, memberId: "admin-1" },
      executiveActor,
    );
    expect(mockGetReceiptStats).toHaveBeenCalledWith({ memberId: "admin-1" });
    expect(mockListWelfareSupport).toHaveBeenCalledWith({
      memberId: "admin-1",
      page: 1,
      pageSize: 1,
    });
    expect(status.monthlyDuesPaid).toBe(true);
    expect(status.paymentCount).toBe(3);
    expect(status.receiptCount).toBe(2);
    expect(status.welfareSupportCount).toBe(1);
  });
});
