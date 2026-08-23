import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentStatus,
  PaymentType,
  WelfareSupportStatus,
  WelfareSupportType,
} from "@/types/enums";

/**
 * Admin/Treasurer dashboard welfare KPI cards use getUnifiedWelfarePaidStats()
 * from src/lib/welfare/history.ts (via src/app/admin/dashboard/page.tsx).
 */
const mockFetchFilteredWelfareSupport = vi.fn();
const mockListAllWelfareSupportTypeOptions = vi.fn();
const mockPaymentsGet = vi.fn();
const mockCollection = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/welfare/repository", () => ({
  fetchFilteredWelfareSupport: (...args: unknown[]) =>
    mockFetchFilteredWelfareSupport(...args),
}));

vi.mock("@/lib/welfare-support-types/repository", () => ({
  listAllWelfareSupportTypeOptions: (...args: unknown[]) =>
    mockListAllWelfareSupportTypeOptions(...args),
}));

const { getUnifiedWelfarePaidStats } = await import("@/lib/welfare/history");

const standaloneWelfare = {
  id: "ws-1",
  memberId: "member-1",
  memberName: "John Doe",
  serviceNumber: "IS/13984",
  supportType: WelfareSupportType.FUNERAL,
  amount: 500,
  description: "Funeral support",
  status: WelfareSupportStatus.APPROVED,
  approvedBy: "admin-1",
  approvedByName: "Admin User",
  recordedBy: "admin-1",
  recordedByName: "Admin User",
  supportYear: 2026,
  supportMonth: 8,
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
};

function makeClaimPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    memberId: "member-2",
    memberName: "Brony Hans",
    serviceNumber: "IS/10002",
    email: "brony@example.com",
    amount: 1250,
    currency: "GHS",
    reference: "GIS-20260823-EWZEDM",
    paymentType: PaymentType.CLAIM_PAYMENT,
    provider: "manual",
    providerReference: null,
    status: PaymentStatus.SUCCESS,
    paymentMethod: "cash",
    claimId: "claim-1",
    claimNumber: "CLM-2026-001",
    claimTypeCode: "child_birth",
    claimTypeDisplayName: "Child Birth",
    paidById: "treasurer-1",
    paidByName: "Treasurer User",
    createdAt: "2026-08-23T08:00:00.000Z",
    updatedAt: "2026-08-23T08:30:00.000Z",
    paidAt: "2026-08-23T08:30:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListAllWelfareSupportTypeOptions.mockResolvedValue([
    { code: WelfareSupportType.FUNERAL, displayName: "Funeral Support", active: true },
  ]);
  mockFetchFilteredWelfareSupport.mockResolvedValue([]);
  mockCollection.mockImplementation((name: string) => {
    if (name === "payments") {
      return { get: mockPaymentsGet };
    }
    return { get: vi.fn() };
  });
  mockPaymentsGet.mockResolvedValue({
    docs: [
      {
        id: "pay-1",
        data: () => makeClaimPayment(),
      },
    ],
  });
});

describe("dashboard welfare statistics (getUnifiedWelfarePaidStats)", () => {
  it("includes successful CLAIM_PAYMENT in dashboard welfare totals", async () => {
    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalRecords).toBe(1);
    expect(stats.totalAmount).toBe(1250);
    expect(stats.membersAssisted).toBe(1);
  });

  it("includes standalone welfare_support in dashboard welfare totals", async () => {
    mockPaymentsGet.mockResolvedValue({ docs: [] });
    mockFetchFilteredWelfareSupport.mockResolvedValue([standaloneWelfare]);

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalRecords).toBe(1);
    expect(stats.totalAmount).toBe(500);
    expect(stats.membersAssisted).toBe(1);
  });

  it("combines both sources without duplication", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([standaloneWelfare]);

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalRecords).toBe(2);
    expect(stats.totalAmount).toBe(1750);
  });

  it("counts unique members assisted across both sources", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([standaloneWelfare]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-1",
          data: () => makeClaimPayment({ memberId: "member-1" }),
        },
      ],
    });

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.membersAssisted).toBe(1);
    expect(stats.totalRecords).toBe(2);
  });
});
