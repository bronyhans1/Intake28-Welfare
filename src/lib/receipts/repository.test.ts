import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContributionType } from "@/types/enums";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockRunTransaction = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  }),
}));

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: vi.fn(),
}));

import { createReceipt } from "@/lib/receipts/repository";

const receiptInput = {
  paymentId: "payment-1",
  paymentReference: "GIS-20260619-AB1234",
  contributionId: "contribution-1",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/00002",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  currency: "GHS" as const,
  issuedBy: "admin-1",
};

function makeReceiptData(overrides: Record<string, unknown> = {}) {
  return {
    receiptNumber: "GIS-RCP-20260619-K4FWKR",
    paymentId: "payment-1",
    paymentReference: "GIS-20260619-AB1234",
    contributionId: "contribution-1",
    memberId: "member-1",
    memberName: "Member User",
    serviceNumber: "IS/00002",
    contributionType: ContributionType.MONTHLY_DUES,
    amount: 50,
    currency: "GHS",
    status: "issued",
    issuedAt: { seconds: 1, nanoseconds: 0 },
    issuedBy: "admin-1",
    createdAt: { seconds: 1, nanoseconds: 0 },
    ...overrides,
  };
}

describe("createReceipt idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
      orderBy: mockOrderBy,
      where: mockWhere,
    });
    mockDoc.mockImplementation((id?: string) => ({
      id: id ?? "GIS-20260619-AB1234",
      get: mockGet,
    }));
    mockOrderBy.mockReturnValue({ get: mockGet });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ get: mockGet });

    mockRunTransaction.mockImplementation(async (callback: (tx: {
      get: typeof mockGet;
      create: ReturnType<typeof vi.fn>;
    }) => Promise<void>) => {
      const tx = {
        get: mockGet,
        create: vi.fn(),
      };
      await callback(tx);
    });
  });

  it("returns an existing receipt without creating a duplicate", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: "GIS-20260619-AB1234",
      data: () => makeReceiptData(),
    });

    const result = await createReceipt(receiptInput);

    expect(result.created).toBe(false);
    expect(result.receipt.paymentReference).toBe("GIS-20260619-AB1234");
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("uses the payment reference as the deterministic receipt document id", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        id: "GIS-20260619-AB1234",
        data: () => makeReceiptData(),
      });

    const result = await createReceipt(receiptInput);

    expect(mockDoc).toHaveBeenCalledWith("GIS-20260619-AB1234");
    expect(mockRunTransaction).toHaveBeenCalled();
    expect(result.created).toBe(true);
    expect(result.receipt.id).toBe("GIS-20260619-AB1234");
  });
});
