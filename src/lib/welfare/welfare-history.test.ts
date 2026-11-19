import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaymentStatus,
  PaymentType,
  UserRole,
  WelfareSupportStatus,
  WelfareSupportType,
} from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

const mockWelfareGet = vi.fn();
const mockPaymentsGet = vi.fn();
const mockCollection = vi.fn();
const mockFetchFilteredWelfareSupport = vi.fn();
const mockListAllWelfareSupportTypeOptions = vi.fn();
const mockGetMemberById = vi.fn();
const mockRequireOwnMemberId = vi.fn();

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

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/members/member-context", () => ({
  requireOwnMemberId: (...args: unknown[]) => mockRequireOwnMemberId(...args),
  assertOwnMemberScope: vi.fn(),
}));

const { listWelfareHistory, listMemberWelfareHistory, getUnifiedWelfarePaidStats } =
  await import("@/lib/welfare/history");

const memberActor: CurrentUser = {
  uid: "member-1",
  fullName: "John Doe",
  serviceNumber: "IS/13984",
  role: UserRole.MEMBER,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const treasurerActor: CurrentUser = {
  uid: "treasurer-1",
  fullName: "Treasurer User",
  serviceNumber: "IS/10002",
  role: UserRole.TREASURER,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const adminActor: CurrentUser = {
  uid: "admin-1",
  fullName: "Admin User",
  serviceNumber: "IS/00001",
  role: UserRole.ADMIN,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

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
    memberId: "member-1",
    memberName: "John Doe",
    serviceNumber: "IS/13984",
    email: "member@example.com",
    amount: 2000,
    currency: "GHS",
    reference: "CLM-REF-001",
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

  mockRequireOwnMemberId.mockImplementation(async (actor: CurrentUser) => actor.uid);
  mockGetMemberById.mockResolvedValue({ id: "member-1" });

  mockListAllWelfareSupportTypeOptions.mockResolvedValue([
    { code: WelfareSupportType.FUNERAL, displayName: "Funeral Support", active: true },
  ]);

  mockFetchFilteredWelfareSupport.mockResolvedValue([standaloneWelfare]);

  mockCollection.mockImplementation((name: string) => {
    if (name === "payments") {
      return {
        get: mockPaymentsGet,
        where: vi.fn().mockReturnValue({ get: mockPaymentsGet }),
      };
    }
    return { get: mockWelfareGet };
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

describe("listWelfareHistory", () => {
  it("includes standalone welfare support records", async () => {
    mockPaymentsGet.mockResolvedValue({ docs: [] });

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("welfare_support");
    expect(result.entries[0]?.benefitTypeLabel).toBe("Funeral Support");
  });

  it("includes successful CLAIM_PAYMENT records", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("claim_payment");
    expect(result.entries[0]?.benefitTypeLabel).toBe("Child Birth");
    expect(result.entries[0]?.amount).toBe(2000);
    expect(result.entries[0]?.statusLabel).toBe("Paid");
  });

  it("identifies claim payments with Claim Payment source", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries[0]?.source).toBe("claim_payment");
    expect(result.entries[0]?.memberName).toBe("John Doe");
    expect(result.entries[0]?.serviceNumber).toBe("IS/13984");
    expect(result.entries[0]?.recordedByName).toBe("Treasurer User");
    expect(result.entries[0]?.occurredAt).toBe("2026-08-23T08:30:00.000Z");
  });

  it("filters by source=welfare_support", async () => {
    const result = await listWelfareHistory({
      page: 1,
      pageSize: 10,
      source: "welfare_support",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("welfare_support");
    expect(mockPaymentsGet).not.toHaveBeenCalled();
  });

  it("filters by source=claim_payment", async () => {
    const result = await listWelfareHistory({
      page: 1,
      pageSize: 10,
      source: "claim_payment",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("claim_payment");
    expect(mockFetchFilteredWelfareSupport).not.toHaveBeenCalled();
  });

  it("excludes non-success claim payments", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-pending",
          data: () =>
            makeClaimPayment({
              id: "pay-pending",
              status: PaymentStatus.PENDING,
            }),
        },
        {
          id: "pay-failed",
          data: () =>
            makeClaimPayment({
              id: "pay-failed",
              status: PaymentStatus.FAILED,
            }),
        },
      ],
    });

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(0);
  });

  it("excludes non-claim payment types", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-dues",
          data: () =>
            makeClaimPayment({
              id: "pay-dues",
              paymentType: PaymentType.MONTHLY_DUES,
            }),
        },
      ],
    });

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(0);
  });

  it("deduplicates claim payments by claimId", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-1",
          data: () => makeClaimPayment({ id: "pay-1" }),
        },
        {
          id: "pay-2",
          data: () =>
            makeClaimPayment({
              id: "pay-2",
              reference: "CLM-REF-002",
            }),
        },
      ],
    });

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.paymentId).toBe("pay-1");
  });

  it("scopes claim payments to memberId when provided", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-other",
          data: () =>
            makeClaimPayment({
              id: "pay-other",
              memberId: "member-2",
              memberName: "Jane Smith",
            }),
        },
        {
          id: "pay-self",
          data: () => makeClaimPayment({ id: "pay-self", memberId: "member-1" }),
        },
      ],
    });

    const result = await listWelfareHistory({
      page: 1,
      pageSize: 10,
      memberId: "member-1",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.memberId).toBe("member-1");
  });

  it("filters claim payments by month and year using payment date", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-aug",
          data: () =>
            makeClaimPayment({
              id: "pay-aug",
              claimId: "claim-aug",
              paidAt: "2026-08-23T08:30:00.000Z",
            }),
        },
        {
          id: "pay-july",
          data: () =>
            makeClaimPayment({
              id: "pay-july",
              claimId: "claim-july",
              paidAt: "2026-07-15T08:30:00.000Z",
            }),
        },
      ],
    });

    const result = await listWelfareHistory({
      page: 1,
      pageSize: 10,
      supportMonth: 8,
      supportYear: 2026,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.paymentId).toBe("pay-aug");
  });

  it("sorts merged entries by occurredAt descending", async () => {
    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.source).toBe("claim_payment");
    expect(result.entries[1]?.source).toBe("welfare_support");
  });

  it("maps status filter Paid to claim payments only when appropriate", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([
      {
        ...standaloneWelfare,
        id: "ws-pending",
        status: WelfareSupportStatus.PENDING,
      },
    ]);

    const result = await listWelfareHistory({
      page: 1,
      pageSize: 10,
      status: WelfareSupportStatus.PAID,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("claim_payment");
  });

  it("preserves standalone welfare support unchanged", async () => {
    mockPaymentsGet.mockResolvedValue({ docs: [] });

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });

    const entry = result.entries[0];
    expect(entry?.welfareSupportId).toBe("ws-1");
    expect(entry?.amount).toBe(500);
    expect(entry?.description).toBe("Funeral support");
  });
});

describe("listMemberWelfareHistory", () => {
  it("returns member's own standalone welfare support", async () => {
    mockPaymentsGet.mockResolvedValue({ docs: [] });

    const result = await listMemberWelfareHistory(memberActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries.some((e) => e.source === "welfare_support")).toBe(true);
    expect(mockRequireOwnMemberId).toHaveBeenCalledWith(memberActor);
  });

  it("returns member's own paid CLAIM_PAYMENT", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);

    const result = await listMemberWelfareHistory(memberActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("claim_payment");
    expect(result.entries[0]?.benefitTypeLabel).toBe("Child Birth");
  });

  it("returns linked treasurer own paid CLAIM_PAYMENT", async () => {
    mockRequireOwnMemberId.mockResolvedValue("treasurer-1");
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-self",
          data: () =>
            makeClaimPayment({
              id: "pay-self",
              memberId: "treasurer-1",
              memberName: "Treasurer User",
            }),
        },
      ],
    });

    const result = await listMemberWelfareHistory(treasurerActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.memberId).toBe("treasurer-1");
  });

  it("returns linked admin own paid CLAIM_PAYMENT", async () => {
    mockRequireOwnMemberId.mockResolvedValue("admin-1");
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-admin",
          data: () =>
            makeClaimPayment({
              id: "pay-admin",
              memberId: "admin-1",
            }),
        },
      ],
    });

    const result = await listMemberWelfareHistory(adminActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.source).toBe("claim_payment");
  });

  it("scopes history to resolved own member id", async () => {
    mockRequireOwnMemberId.mockResolvedValue("member-1");
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-other",
          data: () =>
            makeClaimPayment({
              id: "pay-other",
              memberId: "member-2",
              memberName: "Jane Smith",
            }),
        },
      ],
    });

    const result = await listMemberWelfareHistory(memberActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries).toHaveLength(0);
  });

  it("rejects when no linked member context exists", async () => {
    mockRequireOwnMemberId.mockRejectedValue(new Error("Member context required."));

    await expect(
      listMemberWelfareHistory(adminActor, { page: 1, pageSize: 10 }),
    ).rejects.toThrow("Member context required.");
  });

  it("does not surface awaiting-payment claims as paid welfare", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-awaiting",
          data: () =>
            makeClaimPayment({
              id: "pay-awaiting",
              status: PaymentStatus.PENDING,
            }),
        },
      ],
    });

    const result = await listMemberWelfareHistory(memberActor, {
      page: 1,
      pageSize: 10,
    });

    expect(result.entries).toHaveLength(0);
  });
});

describe("welfare history read model guarantees", () => {
  it("reads from welfare_support and payments without creating records", async () => {
    await listWelfareHistory({ page: 1, pageSize: 10 });

    expect(mockFetchFilteredWelfareSupport).toHaveBeenCalled();
    expect(mockPaymentsGet).toHaveBeenCalled();
  });

  it("uses canonical payment fields for claim payment display", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);

    const result = await listWelfareHistory({ page: 1, pageSize: 10 });
    const entry = result.entries[0];

    expect(entry?.claimId).toBe("claim-1");
    expect(entry?.claimNumber).toBe("CLM-2026-001");
    expect(entry?.paymentId).toBe("pay-1");
    expect(entry?.reference).toBe("CLM-REF-001");
  });
});

describe("getUnifiedWelfarePaidStats", () => {
  it("includes standalone welfare support in welfare paid total", async () => {
    mockPaymentsGet.mockResolvedValue({ docs: [] });

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalAmount).toBe(500);
    expect(stats.totalRecords).toBe(1);
  });

  it("includes successful CLAIM_PAYMENT in welfare paid total", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalAmount).toBe(2000);
    expect(stats.totalRecords).toBe(1);
  });

  it("calculates combined welfare paid from both sources", async () => {
    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalAmount).toBe(2500);
    expect(stats.totalRecords).toBe(2);
    expect(stats.membersAssisted).toBe(1);
  });

  it("excludes failed CLAIM_PAYMENT from welfare paid total", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-failed",
          data: () =>
            makeClaimPayment({
              id: "pay-failed",
              status: PaymentStatus.FAILED,
            }),
        },
      ],
    });

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalAmount).toBe(0);
    expect(stats.totalRecords).toBe(0);
  });

  it("excludes pending CLAIM_PAYMENT from welfare paid total", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-pending",
          data: () =>
            makeClaimPayment({
              id: "pay-pending",
              status: PaymentStatus.PENDING,
            }),
        },
      ],
    });

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalAmount).toBe(0);
    expect(stats.totalRecords).toBe(0);
  });

  it("counts each claim payment exactly once", async () => {
    mockFetchFilteredWelfareSupport.mockResolvedValue([]);
    mockPaymentsGet.mockResolvedValue({
      docs: [
        {
          id: "pay-1",
          data: () => makeClaimPayment({ id: "pay-1" }),
        },
        {
          id: "pay-2",
          data: () =>
            makeClaimPayment({
              id: "pay-2",
              reference: "CLM-REF-002",
            }),
        },
      ],
    });

    const stats = await getUnifiedWelfarePaidStats();

    expect(stats.totalRecords).toBe(1);
    expect(stats.totalAmount).toBe(2000);
  });

  it("applies member and period filters to unified welfare paid stats", async () => {
    await getUnifiedWelfarePaidStats({
      memberId: "member-1",
      month: 8,
      year: 2026,
    });

    expect(mockFetchFilteredWelfareSupport).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member-1",
        supportMonth: 8,
        supportYear: 2026,
      }),
    );
  });
});
