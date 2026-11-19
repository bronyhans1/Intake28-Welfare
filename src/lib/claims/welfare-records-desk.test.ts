import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClaimStatus,
  PaymentCategory,
  PaymentMethod,
  PaymentType,
  UserRole,
} from "@/types/enums";
import { canProcessClaimPayments } from "@/lib/claims/claim-access";
import { hasPermission, Permission } from "@/lib/auth/permissions";

const mockCreateAuditLog = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockCreateClaimDisbursementPayment = vi.fn();
const mockGetMemberById = vi.fn();
const mockGetSystemSettings = vi.fn();
const mockNotifyClaimPaid = vi.fn();
const mockWhere = vi.fn();
const mockClaimsGet = vi.fn();
const mockAllClaimsGet = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firestore/sanitize", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/firestore/sanitize")
  >("@/lib/firestore/sanitize");
  return {
    ...actual,
    warnInvalidFirestorePayload: vi.fn(),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/payments/repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/payments/repository")
  >("@/lib/payments/repository");
  return {
    ...actual,
    createClaimDisbursementPayment: (...args: unknown[]) =>
      mockCreateClaimDisbursementPayment(...args),
  };
});

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getSystemSettings: (...args: unknown[]) => mockGetSystemSettings(...args),
}));

vi.mock("@/lib/payments/member-email", () => ({
  deriveMemberPaymentEmailAddress: () => "member@example.com",
}));

vi.mock("@/lib/notifications/claim-events", () => ({
  notifyClaimPaid: (...args: unknown[]) => mockNotifyClaimPaid(...args),
  notifyClaimApproved: vi.fn(),
  notifyClaimSentToFinance: vi.fn(),
}));

const {
  listMemberAwaitingPaymentClaims,
  listAwaitingPaymentClaims,
  buildWelfareRecordsPayDeskUrl,
} = await import("@/lib/claims/claim-repository");

const {
  payClaimFromWelfareRecords,
  startClaimPaymentProcessing,
  completeClaimPayment,
} = await import("@/lib/claims/claim-finance");

const treasurerActor = {
  uid: "treasurer-1",
  fullName: "Treasurer User",
  role: UserRole.TREASURER,
  serviceNumber: "IS/2",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/10002",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const awaitingClaim = {
  reference: "GIS-2026-00001",
  claimNumber: "GIS-2026-00001",
  memberId: "member-1",
  memberName: "Brony Hans",
  serviceNumber: "IS/10002",
  claimTypeCode: "child_birth",
  claimTypeDisplayName: "Child Birth",
  status: ClaimStatus.AWAITING_PAYMENT,
  title: "Child birth support",
  description: "Newborn assistance",
  approvedBenefitAmount: 2000,
  finalAmount: 2000,
  paymentId: null,
  auditHistory: [],
  currency: "GHS",
  createdBy: "member-1",
  createdByName: "Brony Hans",
  financeQueuedAt: "2026-08-01T10:00:00.000Z",
  approvedAt: "2026-08-01T10:00:00.000Z",
  createdAt: { seconds: 1, nanoseconds: 0 },
  updatedAt: { seconds: 1, nanoseconds: 0 },
};

function mockSingleClaimDoc(data: Record<string, unknown>) {
  mockGet.mockResolvedValue({
    exists: true,
    id: "claim-1",
    data: () => ({ ...data }),
  });
}

function mockAllClaimsQuery(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  mockAllClaimsGet.mockResolvedValue({
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => doc.data,
    })),
  });
}

function mockMemberClaimsQuery(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  mockClaimsGet.mockResolvedValue({
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => doc.data,
    })),
  });
  mockWhere.mockReturnValue({ get: mockClaimsGet });
}

describe("Welfare Records desk — member awaiting payment lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((id?: string) => ({
      id: id ?? "claim-1",
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
    }));
    mockCollection.mockImplementation((name: string) => {
      if (name === "claims") {
        return {
          doc: mockDoc,
          where: (...args: unknown[]) => mockWhere(...args),
          get: mockAllClaimsGet,
        };
      }
      return { doc: mockDoc };
    });
  });

  it("returns awaiting payment claims for a member", async () => {
    mockMemberClaimsQuery([
      { id: "claim-1", data: awaitingClaim },
      {
        id: "claim-2",
        data: {
          ...awaitingClaim,
          claimNumber: "GIS-2026-00002",
          status: ClaimStatus.SUBMITTED,
          approvedBenefitAmount: null,
        },
      },
    ]);

    const claims = await listMemberAwaitingPaymentClaims("member-1");
    expect(claims).toHaveLength(1);
    expect(claims[0].id).toBe("claim-1");
    expect(claims[0].claimTypeDisplayName).toBe("Child Birth");
    expect(claims[0].approvedBenefitAmount).toBe(2000);
    expect(claims[0].status).toBe(ClaimStatus.AWAITING_PAYMENT);
  });

  it("returns empty list when member has no awaiting claims", async () => {
    mockMemberClaimsQuery([
      {
        id: "claim-paid",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAID,
          paymentId: "payment-old",
        },
      },
    ]);

    const claims = await listMemberAwaitingPaymentClaims("member-1");
    expect(claims).toEqual([]);
  });

  it("includes payment_processing claims without paymentId", async () => {
    mockMemberClaimsQuery([
      {
        id: "claim-processing",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAYMENT_PROCESSING,
          paymentId: null,
        },
      },
    ]);

    const claims = await listMemberAwaitingPaymentClaims("member-1");
    expect(claims).toHaveLength(1);
    expect(claims[0].status).toBe(ClaimStatus.PAYMENT_PROCESSING);
  });

  it("excludes claims that already have a paymentId", async () => {
    mockMemberClaimsQuery([
      {
        id: "claim-linked",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAYMENT_PROCESSING,
          paymentId: "payment-1",
        },
      },
    ]);

    const claims = await listMemberAwaitingPaymentClaims("member-1");
    expect(claims).toEqual([]);
  });
});

describe("Welfare Records desk — all awaiting payment list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((name: string) => {
      if (name === "claims") {
        return {
          doc: mockDoc,
          where: (...args: unknown[]) => mockWhere(...args),
          get: mockAllClaimsGet,
        };
      }
      return { doc: mockDoc };
    });
  });

  it("returns all claims awaiting treasurer payment", async () => {
    mockAllClaimsQuery([
      { id: "claim-1", data: awaitingClaim },
      {
        id: "claim-2",
        data: {
          ...awaitingClaim,
          id: "claim-2",
          memberId: "member-2",
          memberName: "Jane Smith",
          serviceNumber: "IS/10003",
          claimNumber: "GIS-2026-00002",
        },
      },
      {
        id: "claim-paid",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAID,
          paymentId: "payment-old",
        },
      },
    ]);

    const claims = await listAwaitingPaymentClaims();
    expect(claims).toHaveLength(2);
    expect(claims.map((claim) => claim.id)).toEqual(["claim-1", "claim-2"]);
  });

  it("excludes paid claims from the awaiting payment list", async () => {
    mockAllClaimsQuery([
      {
        id: "claim-paid",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAID,
          paymentId: "payment-old",
        },
      },
    ]);

    const claims = await listAwaitingPaymentClaims();
    expect(claims).toEqual([]);
  });

  it("excludes claims that already have a paymentId", async () => {
    mockAllClaimsQuery([
      {
        id: "claim-linked",
        data: {
          ...awaitingClaim,
          status: ClaimStatus.PAYMENT_PROCESSING,
          paymentId: "payment-1",
        },
      },
    ]);

    const claims = await listAwaitingPaymentClaims();
    expect(claims).toEqual([]);
  });

  it("includes claim type, member, service number, and approved amount", async () => {
    mockAllClaimsQuery([{ id: "claim-1", data: awaitingClaim }]);

    const claims = await listAwaitingPaymentClaims();
    expect(claims[0]).toMatchObject({
      memberName: "Brony Hans",
      serviceNumber: "IS/10002",
      claimTypeDisplayName: "Child Birth",
      claimNumber: "GIS-2026-00001",
      approvedBenefitAmount: 2000,
      status: ClaimStatus.AWAITING_PAYMENT,
    });
  });

  it("builds Pay Now URL for the existing payment desk flow", () => {
    expect(buildWelfareRecordsPayDeskUrl("member-1", "claim-1")).toBe(
      "/admin/welfare-support/new?memberId=member-1&claimId=claim-1",
    );
  });
});

describe("Welfare Records desk — payClaimFromWelfareRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
      id: "payment-1",
    });
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockUpdate.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockNotifyClaimPaid.mockResolvedValue(undefined);
    mockGetSystemSettings.mockResolvedValue({ currency: "GHS" });
    mockGetMemberById.mockResolvedValue({
      id: "member-1",
      fullName: "Brony Hans",
      serviceNumber: "IS/10002",
      email: "member@example.com",
    });
    mockCreateClaimDisbursementPayment.mockResolvedValue({
      id: "payment-1",
      reference: "GIS-REF-1",
      amount: 2000,
      paymentCategory: PaymentCategory.CLAIM,
      paymentType: PaymentType.CLAIM_PAYMENT,
      claimId: "claim-1",
      claimNumber: "GIS-2026-00001",
      claimTypeCode: "child_birth",
      claimTypeDisplayName: "Child Birth",
    });
  });

  it("orchestrates awaiting_payment → payment_processing → paid using approved amount", async () => {
    let currentStatus: string = ClaimStatus.AWAITING_PAYMENT;
    mockGet.mockImplementation(async () => ({
      exists: true,
      id: "claim-1",
      data: () => ({
        ...awaitingClaim,
        status: currentStatus,
        paymentId: null,
      }),
    }));
    mockUpdate.mockImplementation(async (payload: Record<string, unknown>) => {
      if (typeof payload.status === "string") {
        currentStatus = payload.status;
      }
    });

    const result = await payClaimFromWelfareRecords(
      "claim-1",
      {
        amount: 2000,
        paymentDate: "2026-08-20",
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        referenceNumber: "MOMO-1",
        financeNotes: "Paid from Welfare Records",
        amountReductionReason: null,
      },
      treasurerActor as never,
    );

    expect(result.paymentId).toBe("payment-1");
    expect(mockCreateClaimDisbursementPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: "claim-1",
        claimNumber: "GIS-2026-00001",
        claimTypeCode: "child_birth",
        claimTypeDisplayName: "Child Birth",
        amount: 2000,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
      }),
    );
    expect(mockCreateClaimDisbursementPayment).toHaveBeenCalledTimes(1);

    const statuses = mockUpdate.mock.calls.map(
      (call) => (call[0] as Record<string, unknown>).status,
    );
    expect(statuses).toContain(ClaimStatus.PAYMENT_PROCESSING);
    expect(statuses).toContain(ClaimStatus.PAID);

    const paidUpdate = mockUpdate.mock.calls.find(
      (call) =>
        (call[0] as Record<string, unknown>).status === ClaimStatus.PAID,
    )?.[0] as Record<string, unknown>;
    expect(paidUpdate.paymentId).toBe("payment-1");
  });

  it("blocks duplicate payment when claim already has paymentId", async () => {
    mockSingleClaimDoc({
      ...awaitingClaim,
      status: ClaimStatus.PAID,
      paymentId: "payment-existing",
    });

    await expect(
      payClaimFromWelfareRecords(
        "claim-1",
        {
          amount: 2000,
          paymentDate: "2026-08-20",
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: null,
          financeNotes: null,
          amountReductionReason: null,
        },
        treasurerActor as never,
      ),
    ).rejects.toThrow(/already been paid/i);

    expect(mockCreateClaimDisbursementPayment).not.toHaveBeenCalled();
  });

  it("blocks unauthorized members from paying claims", async () => {
    mockSingleClaimDoc(awaitingClaim);

    await expect(
      payClaimFromWelfareRecords(
        "claim-1",
        {
          amount: 2000,
          paymentDate: "2026-08-20",
          paymentMethod: PaymentMethod.CASH,
          referenceNumber: null,
          financeNotes: null,
          amountReductionReason: null,
        },
        memberActor as never,
      ),
    ).rejects.toThrow(/permission/i);
  });

  it("does not create a welfare_support record when paying a claim", async () => {
    let currentStatus: string = ClaimStatus.AWAITING_PAYMENT;
    mockGet.mockImplementation(async () => ({
      exists: true,
      id: "claim-1",
      data: () => ({
        ...awaitingClaim,
        status: currentStatus,
        paymentId: null,
      }),
    }));
    mockUpdate.mockImplementation(async (payload: Record<string, unknown>) => {
      if (typeof payload.status === "string") {
        currentStatus = payload.status;
      }
    });

    await payClaimFromWelfareRecords(
      "claim-1",
      {
        amount: 2000,
        paymentDate: "2026-08-20",
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNumber: null,
        financeNotes: null,
        amountReductionReason: null,
      },
      treasurerActor as never,
    );

    const collectionsTouched = mockCollection.mock.calls.map((call) => call[0]);
    expect(collectionsTouched).not.toContain("welfare_support");
  });

  it("keeps existing Finance Claims start/complete path functional", async () => {
    mockSingleClaimDoc({
      ...awaitingClaim,
      status: ClaimStatus.AWAITING_PAYMENT,
    });
    await startClaimPaymentProcessing("claim-1", treasurerActor as never);
    expect(mockUpdate.mock.calls[0][0].status).toBe(
      ClaimStatus.PAYMENT_PROCESSING,
    );

    mockSingleClaimDoc({
      ...awaitingClaim,
      status: ClaimStatus.PAYMENT_PROCESSING,
      paymentId: null,
    });
    const result = await completeClaimPayment(
      "claim-1",
      {
        amount: 2000,
        paymentDate: "2026-08-20",
        paymentMethod: PaymentMethod.CASH,
        referenceNumber: null,
        financeNotes: null,
        amountReductionReason: null,
      },
      treasurerActor as never,
    );
    expect(result.paymentId).toBe("payment-1");
  });
});

describe("Welfare Records desk — permissions and domain separation", () => {
  it("allows treasurer and admin to process claim payments", () => {
    expect(canProcessClaimPayments(UserRole.TREASURER)).toBe(true);
    expect(canProcessClaimPayments(UserRole.ADMIN)).toBe(true);
    expect(canProcessClaimPayments(UserRole.MEMBER)).toBe(false);
  });

  it("keeps welfare support create permission separate from claim payment", () => {
    expect(
      hasPermission(UserRole.TREASURER, Permission.CREATE_WELFARE_SUPPORT),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.MEMBER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(false);
  });
});
