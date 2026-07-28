import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  formatAuditActionLabel,
  formatAuditDescription,
} from "@/lib/audit/labels";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  generatePaymentReference,
  isPaymentReference,
} from "@/lib/payments/reference";
import {
  canInitializePayments,
  canViewPayments,
  createPayment,
  getPaymentByReference,
  initializePayment,
  listPayments,
  updatePaymentStatus,
  verifyPayment,
} from "@/lib/payments/repository";
import { mapPaystackStatus } from "@/lib/integrations/paystack/client";
import {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";

const mockCreateAuditLog = vi.fn();
const mockGetMemberById = vi.fn();
const mockGetSystemSettings = vi.fn();
const mockPaystackInitialize = vi.fn();
const mockPaystackVerify = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getSystemSettings: () => mockGetSystemSettings(),
}));

vi.mock("@/lib/integrations/paystack/client", () => ({
  paystackInitializeTransaction: (...args: unknown[]) => mockPaystackInitialize(...args),
  paystackVerifyTransaction: (...args: unknown[]) => mockPaystackVerify(...args),
  mapPaystackStatus: (status: string) => {
    if (status === "success") return "success";
    if (status === "failed") return "failed";
    if (status === "abandoned") return "abandoned";
    return "pending";
  },
}));

const mockEnsureContributionFromPayment = vi.fn();
const mockAssertMonthlyDuesPaymentAllowed = vi.fn();

vi.mock("@/lib/payments/contribution-automation", () => ({
  ensureContributionFromPayment: (...args: unknown[]) =>
    mockEnsureContributionFromPayment(...args),
}));

vi.mock("@/lib/payments/monthly-dues-guard", () => ({
  assertMonthlyDuesPaymentAllowed: (...args: unknown[]) =>
    mockAssertMonthlyDuesPaymentAllowed(...args),
  normalizeSelectedMonths: (
    months: Array<{ month: number; year: number }>,
  ) => months,
}));

vi.mock("@/lib/contributions/outstanding-months", () => ({
  getMemberOutstandingContributions: vi.fn().mockResolvedValue({
    membershipStart: { month: 1, year: 2026 },
    currentMonth: { month: 6, year: 2026 },
    monthlyDuesAmount: 50,
    arrears: [],
    current: {
      month: 6,
      year: 2026,
      label: "June 2026",
      amount: 50,
      isCurrent: true,
    },
    outstanding: [
      {
        month: 6,
        year: 2026,
        label: "June 2026",
        amount: 50,
        isCurrent: true,
      },
    ],
  }),
  resolveContributionStartMonth: () => ({ month: 1, year: 2026 }),
  assertMonthsWithinContributionWindow: vi.fn(),
}));

vi.mock("@/lib/payments/lifecycle", () => ({
  abandonStalePendingPayments: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/config/env", () => ({
  env: {
    client: () => ({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }),
    server: () => ({}),
  },
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/00002",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const treasurerActor = {
  ...memberActor,
  uid: "treasurer-1",
  role: UserRole.TREASURER,
};

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

function makePaymentDoc(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    data: () => ({
      memberId: "member-1",
      memberName: "Member User",
      serviceNumber: "IS/00002",
      email: "IS00002@gis28welfare.org",
      amount: 50,
      currency: "GHS",
      reference: "GIS-20260617-AB1234",
      paymentType: PaymentType.MONTHLY_DUES,
      provider: PaymentProvider.PAYSTACK,
      providerReference: null,
      status: PaymentStatus.PENDING,
      paidAt: null,
      createdAt: makeTimestamp("2026-06-17T10:00:00.000Z"),
      updatedAt: makeTimestamp("2026-06-17T10:00:00.000Z"),
      ...overrides,
    }),
  };
}

describe("payment reference generation", () => {
  it("generates GIS reference format", () => {
    const reference = generatePaymentReference(
      new Date("2026-06-17T12:00:00.000Z"),
      () => 0.123456,
    );

    expect(reference.startsWith("GIS-20260617-")).toBe(true);
    expect(isPaymentReference(reference)).toBe(true);
  });
});

describe("payment permissions", () => {
  it("allows all members including executives to initialize payments", () => {
    expect(canInitializePayments(UserRole.MEMBER)).toBe(true);
    expect(canInitializePayments(UserRole.ADMIN)).toBe(true);
    expect(canInitializePayments(UserRole.TREASURER)).toBe(true);
    expect(canViewPayments(UserRole.ADMIN)).toBe(true);
    expect(canViewPayments(UserRole.TREASURER)).toBe(true);
    expect(canViewPayments(UserRole.MEMBER)).toBe(false);
    expect(hasPermission(UserRole.MEMBER, Permission.MAKE_PAYMENTS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_PAYMENTS)).toBe(true);
  });
});

describe("payments repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureContributionFromPayment.mockResolvedValue({
      outcome: "created",
      contribution: null,
    });
    mockAssertMonthlyDuesPaymentAllowed.mockResolvedValue(undefined);
    mockCollection.mockReturnValue({
      doc: mockDoc,
      orderBy: mockOrderBy,
    });
    mockDoc.mockReturnValue({ id: "payment-1", set: mockSet, get: mockGet, update: mockUpdate });
    mockOrderBy.mockReturnValue({ get: mockGet });
    mockGet.mockReset();
    mockGet.mockResolvedValue({ docs: [], exists: false });
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockGetMemberById.mockResolvedValue({
      id: "member-1",
      fullName: "Member User",
      serviceNumber: "IS/00002",
    });
    mockGetSystemSettings.mockResolvedValue({
      currency: "GHS",
      monthlyDuesAmount: 50,
    });
    mockPaystackInitialize.mockResolvedValue({
      authorizationUrl: "https://checkout.paystack.com/test",
    });
    mockPaystackVerify.mockResolvedValue({
      status: PaymentStatus.SUCCESS,
      providerReference: "GIS-20260617-AB1234",
      paidAt: new Date("2026-06-17T11:00:00.000Z"),
    });
  });

  it("creates pending payments", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1").data(),
    });

    const payment = await createPayment({
      memberId: "member-1",
      memberName: "Member User",
      serviceNumber: "IS/00002",
      email: "IS00002@gis28welfare.org",
      amount: 50,
      currency: "GHS",
      reference: "GIS-20260617-AB1234",
      paymentType: PaymentType.MONTHLY_DUES,
      provider: PaymentProvider.PAYSTACK,
      providerReference: null,
      status: PaymentStatus.PENDING,
    });

    expect(mockSet).toHaveBeenCalled();
    expect(payment.reference).toBe("GIS-20260617-AB1234");
    expect(payment.status).toBe(PaymentStatus.PENDING);
  });

  it("initializes payment and logs payment_initialized", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1").data(),
    });

    const result = await initializePayment(
      {
        memberId: "member-1",
        amount: 50,
        paymentType: PaymentType.MONTHLY_DUES,
        selectedMonths: [{ month: 6, year: 2026 }],
      },
      memberActor,
    );

    expect(result.authorizationUrl).toContain("paystack");
    expect(mockPaystackInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_INITIALIZED,
        entityType: "payment",
        metadata: expect.objectContaining({ amount: 50 }),
      }),
    );
  });

  it("enforces configured monthly dues amount when client submits 5", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1").data(),
    });

    await initializePayment(
      {
        memberId: "member-1",
        amount: 5,
        paymentType: PaymentType.MONTHLY_DUES,
        selectedMonths: [{ month: 6, year: 2026 }],
      },
      memberActor,
    );

    expect(mockPaystackInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50,
      }),
    );
  });

  it("enforces configured monthly dues amount when client submits 500", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1").data(),
    });

    await initializePayment(
      {
        memberId: "member-1",
        amount: 500,
        paymentType: PaymentType.MONTHLY_DUES,
        selectedMonths: [{ month: 6, year: 2026 }],
      },
      memberActor,
    );

    expect(mockPaystackInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
  });

  it("enforces configured monthly dues amount when no amount is supplied", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1").data(),
    });

    await initializePayment(
      {
        memberId: "member-1",
        paymentType: PaymentType.MONTHLY_DUES,
        selectedMonths: [{ month: 6, year: 2026 }],
      },
      memberActor,
    );

    expect(mockPaystackInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
  });

  it("uses submitted amount for special contributions", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      id: "payment-1",
      data: () => makePaymentDoc("payment-1", {
        paymentType: PaymentType.SPECIAL_CONTRIBUTION,
        amount: 100,
      }).data(),
    });

    await initializePayment(
      {
        memberId: "member-1",
        amount: 100,
        paymentType: PaymentType.SPECIAL_CONTRIBUTION,
      },
      memberActor,
    );

    expect(mockPaystackInitialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100 }),
    );
  });

  it("prevents members from initializing payments for other members", async () => {
    await expect(
      initializePayment(
        {
          memberId: "member-2",
          amount: 50,
          paymentType: PaymentType.MONTHLY_DUES,
          selectedMonths: [{ month: 6, year: 2026 }],
        },
        memberActor,
      ),
    ).rejects.toThrow("You can only initialize payments for your own account.");
  });

  it("blocks monthly dues initialization when dues are already paid", async () => {
    mockAssertMonthlyDuesPaymentAllowed.mockRejectedValueOnce(
      new Error("Your monthly dues for June 2026 have already been paid."),
    );

    await expect(
      initializePayment(
        {
          memberId: "member-1",
          amount: 50,
          paymentType: PaymentType.MONTHLY_DUES,
          selectedMonths: [{ month: 6, year: 2026 }],
        },
        memberActor,
      ),
    ).rejects.toThrow("Your monthly dues for June 2026 have already been paid.");

    expect(mockPaystackInitialize).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("verifies payment server-side and updates status", async () => {
    mockGet.mockResolvedValue({
      docs: [
        makePaymentDoc("payment-1", {
          status: PaymentStatus.SUCCESS,
          providerReference: "GIS-20260617-AB1234",
          paidAt: makeTimestamp("2026-06-17T11:00:00.000Z"),
        }),
      ],
    });

    const payment = await verifyPayment("GIS-20260617-AB1234", memberActor);

    expect(mockPaystackVerify).toHaveBeenCalledWith("GIS-20260617-AB1234");
    expect(mockUpdate).toHaveBeenCalled();
    expect(payment.status).toBe(PaymentStatus.SUCCESS);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PaymentAuditAction.PAYMENT_VERIFIED,
      }),
    );
    expect(mockEnsureContributionFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.SUCCESS }),
      memberActor,
    );
  });

  it("lists only member payments for members", async () => {
    const docs = [
      makePaymentDoc("payment-1"),
      makePaymentDoc("payment-2", {
        memberId: "member-2",
        reference: "GIS-20260617-CD5678",
      }),
    ];

    mockGet.mockResolvedValue({ docs });

    const memberResults = await listPayments({ page: 1, pageSize: 20 }, memberActor);
    expect(memberResults.total).toBe(1);
    expect(memberResults.records[0]?.memberId).toBe("member-1");

    const treasurerResults = await listPayments({ page: 1, pageSize: 20 }, treasurerActor);
    expect(treasurerResults.total).toBe(2);

    const treasurerOwnResults = await listPayments(
      { page: 1, pageSize: 20, memberId: "treasurer-1" },
      treasurerActor,
    );
    expect(treasurerOwnResults.total).toBe(0);
  });

  it("hides abandoned payments from members by default", async () => {
    const docs = [
      makePaymentDoc("payment-1"),
      makePaymentDoc("payment-2", {
        status: PaymentStatus.ABANDONED,
        reference: "GIS-20260617-CD5678",
      }),
    ];

    mockGet.mockResolvedValue({ docs });

    const memberResults = await listPayments({ page: 1, pageSize: 20 }, memberActor);
    expect(memberResults.total).toBe(1);
    expect(memberResults.records.every((record) => record.status !== PaymentStatus.ABANDONED)).toBe(
      true,
    );

    const treasurerResults = await listPayments({ page: 1, pageSize: 20 }, treasurerActor);
    expect(treasurerResults.total).toBe(2);
  });

  it("retrieves payment by reference", async () => {
    mockGet.mockResolvedValueOnce({
      docs: [makePaymentDoc("payment-1")],
    });

    const payment = await getPaymentByReference("GIS-20260617-AB1234");
    expect(payment?.reference).toBe("GIS-20260617-AB1234");
  });

  it("updates payment status", async () => {
    mockGet.mockResolvedValue({
      docs: [
        makePaymentDoc("payment-1", {
          status: PaymentStatus.FAILED,
          providerReference: "provider-ref",
        }),
      ],
    });

    const updated = await updatePaymentStatus("GIS-20260617-AB1234", {
      status: PaymentStatus.FAILED,
      providerReference: "provider-ref",
    });

    expect(updated.status).toBe(PaymentStatus.FAILED);
    expect(updated.providerReference).toBe("provider-ref");
  });
});

describe("payment audit labels", () => {
  it("formats payment audit labels and descriptions", () => {
    expect(formatAuditActionLabel(PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED)).toBe(
      "Payment contribution created",
    );
    expect(
      formatAuditDescription(PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED, {
        contributionType: "monthly_dues",
        paymentReference: "GIS-20260618-AB1234",
        outcome: "created",
      }),
    ).toBe("Monthly Dues contribution created from payment GIS-20260618-AB1234");
    expect(formatAuditActionLabel(PaymentAuditAction.PAYMENT_INITIALIZED)).toBe(
      "Payment initialized",
    );
    expect(
      formatAuditDescription(PaymentAuditAction.PAYMENT_INITIALIZED, { amount: 50 }),
    ).toBe("Payment initialized for GHS 50.00");
    expect(
      formatAuditDescription(PaymentAuditAction.PAYMENT_VERIFIED, { status: "success" }),
    ).toBe("Payment verified successfully");
  });
});

describe("mapPaystackStatus", () => {
  it("maps paystack statuses to payment statuses", () => {
    expect(mapPaystackStatus("success")).toBe(PaymentStatus.SUCCESS);
    expect(mapPaystackStatus("failed")).toBe(PaymentStatus.FAILED);
    expect(mapPaystackStatus("abandoned")).toBe(PaymentStatus.ABANDONED);
  });
});
