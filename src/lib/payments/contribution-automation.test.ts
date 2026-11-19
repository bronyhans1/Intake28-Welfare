import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureContributionFromPayment,
  mapPaymentTypeToContributionType,
  PaymentContributionAutomationError,
} from "@/lib/payments/contribution-automation";
import {
  ContributionSource,
  ContributionStatus,
  ContributionType,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";

const mockCreateAuditLog = vi.fn();
const mockGetContributionByPaymentReference = vi.fn();
const mockListContributionsByPaymentReference = vi.fn();
const mockFindPaidMonthlyDuesContribution = vi.fn();
const mockCreateAutomatedContribution = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/contributions/repository", () => ({
  getContributionByPaymentReference: (...args: unknown[]) =>
    mockGetContributionByPaymentReference(...args),
  listContributionsByPaymentReference: (...args: unknown[]) =>
    mockListContributionsByPaymentReference(...args),
  findPaidMonthlyDuesContribution: (...args: unknown[]) =>
    mockFindPaidMonthlyDuesContribution(...args),
  createAutomatedContribution: (...args: unknown[]) =>
    mockCreateAutomatedContribution(...args),
}));

const mockEnsureReceiptFromPayment = vi.fn();

vi.mock("@/lib/receipts/service", () => ({
  ensureReceiptFromPayment: (...args: unknown[]) => mockEnsureReceiptFromPayment(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getMonthlyDuesAmount: vi.fn().mockResolvedValue(50),
}));

const mockNotifyContributionReceived = vi.fn();
const mockNotifyPaymentRecorded = vi.fn();

vi.mock("@/lib/notifications/payment-events", () => ({
  notifyContributionReceived: (...args: unknown[]) =>
    mockNotifyContributionReceived(...args),
  notifyPaymentRecorded: (...args: unknown[]) =>
    mockNotifyPaymentRecorded(...args),
}));

vi.mock("@/lib/finance/period", () => ({
  getCurrentMonthYear: () => ({ month: 6, year: 2026 }),
  formatMonthYearLabel: ({ month, year }: { month: number; year: number }) =>
    `${month}/${year}`,
  monthYearKey: ({ month, year }: { month: number; year: number }) =>
    `${year}-${String(month).padStart(2, "0")}`,
}));

const actor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/00002",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const basePayment = {
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

const createdContribution = {
  id: "contribution-1",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/00002",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  month: 6,
  year: 2026,
  status: ContributionStatus.PAID,
  remarks: "Created from Paystack payment GIS-20260618-AB1234",
  recordedBy: "paystack-automation",
  recordedByName: "Paystack Automation",
  contributionMonth: 6,
  contributionYear: 2026,
  source: ContributionSource.PAYSTACK,
  paymentReference: "GIS-20260618-AB1234",
  paymentId: "payment-1",
  createdAt: "2026-06-18T10:05:01.000Z",
  updatedAt: "2026-06-18T10:05:01.000Z",
};

describe("mapPaymentTypeToContributionType", () => {
  it("maps supported payment types", () => {
    expect(mapPaymentTypeToContributionType(PaymentType.MONTHLY_DUES)).toBe(
      ContributionType.MONTHLY_DUES,
    );
    expect(mapPaymentTypeToContributionType(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      ContributionType.SPECIAL_CONTRIBUTION,
    );
    expect(mapPaymentTypeToContributionType(PaymentType.OTHER)).toBe(ContributionType.OTHER);
  });
});

describe("ensureContributionFromPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContributionByPaymentReference.mockResolvedValue(null);
    mockListContributionsByPaymentReference.mockResolvedValue([]);
    mockFindPaidMonthlyDuesContribution.mockResolvedValue(null);
    mockCreateAutomatedContribution.mockResolvedValue({
      contribution: createdContribution,
      created: true,
    });
    mockEnsureReceiptFromPayment.mockResolvedValue({
      outcome: "created",
      receipt: { id: "receipt-1", receiptNumber: "GIS-RCP-20260618-AB1234" },
    });
  });

  it("creates a monthly dues contribution from a successful payment", async () => {
    const result = await ensureContributionFromPayment(basePayment, actor);

    expect(result.outcome).toBe("created");
    expect(result.contribution?.id).toBe("contribution-1");
    expect(mockCreateAutomatedContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member-1",
        contributionType: ContributionType.MONTHLY_DUES,
        amount: 50,
        month: 6,
        year: 2026,
        source: ContributionSource.PAYSTACK,
        paymentReference: "GIS-20260618-AB1234",
        paymentId: "payment-1",
      }),
    );
  });

  it("records official amount only when checkoutAmount differs (never dues = fee total)", async () => {
    const result = await ensureContributionFromPayment(
      {
        ...basePayment,
        provider: PaymentProvider.HUBTEL,
        amount: 50,
        checkoutAmount: 51,
        processingFeeAmount: 1,
      },
      actor,
    );

    expect(result.outcome).toBe("created");
    expect(mockCreateAutomatedContribution).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 }),
    );
    expect(mockCreateAutomatedContribution).not.toHaveBeenCalledWith(
      expect.objectContaining({ amount: 51 }),
    );
    expect(mockEnsureReceiptFromPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, checkoutAmount: 51 }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("creates one contribution per selected month", async () => {
    mockCreateAutomatedContribution
      .mockResolvedValueOnce({
        contribution: {
          ...createdContribution,
          id: "c-sep",
          month: 9,
          year: 2026,
        },
        created: true,
      })
      .mockResolvedValueOnce({
        contribution: {
          ...createdContribution,
          id: "c-nov",
          month: 11,
          year: 2026,
        },
        created: true,
      });

    const result = await ensureContributionFromPayment(
      {
        ...basePayment,
        amount: 100,
        selectedMonths: [
          { month: 9, year: 2026 },
          { month: 11, year: 2026 },
        ],
      },
      actor,
    );

    expect(result.outcome).toBe("created");
    expect(result.contributions).toHaveLength(2);
    expect(mockCreateAutomatedContribution).toHaveBeenCalledTimes(2);
    expect(mockCreateAutomatedContribution).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ month: 9, year: 2026, amount: 50 }),
    );
    expect(mockCreateAutomatedContribution).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ month: 11, year: 2026, amount: 50 }),
    );
  });

  it("returns existing contribution for repeated verification", async () => {
    mockListContributionsByPaymentReference.mockResolvedValue([
      createdContribution,
    ]);

    const result = await ensureContributionFromPayment(basePayment, actor);

    expect(result.outcome).toBe("existing");
    expect(result.contribution?.id).toBe("contribution-1");
    expect(mockCreateAutomatedContribution).not.toHaveBeenCalled();
    expect(mockEnsureReceiptFromPayment).toHaveBeenCalledWith(
      basePayment,
      createdContribution,
      actor,
    );
  });

  it("skips duplicate monthly dues for the same member and month", async () => {
    const existingMonthlyDues = {
      ...createdContribution,
      id: "existing-contribution",
      paymentReference: "GIS-20260601-OLD123",
      paymentId: "payment-old",
      source: ContributionSource.MANUAL,
    };
    mockFindPaidMonthlyDuesContribution.mockResolvedValue(existingMonthlyDues);

    const result = await ensureContributionFromPayment(basePayment, actor);

    expect(result.outcome).toBe("duplicate_monthly_dues_skipped");
    expect(mockCreateAutomatedContribution).not.toHaveBeenCalled();
  });

  it("creates special contribution records with current business month", async () => {
    const specialPayment = {
      ...basePayment,
      paymentType: PaymentType.SPECIAL_CONTRIBUTION,
      amount: 100,
    };

    mockCreateAutomatedContribution.mockResolvedValue({
      contribution: {
        ...createdContribution,
        id: "contribution-2",
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
        amount: 100,
      },
      created: true,
    });

    const result = await ensureContributionFromPayment(specialPayment, actor);

    expect(result.outcome).toBe("created");
    expect(mockCreateAutomatedContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
        amount: 100,
        month: 6,
        year: 2026,
      }),
    );
    expect(mockFindPaidMonthlyDuesContribution).not.toHaveBeenCalled();
  });

  it("does nothing for non-successful payments", async () => {
    const result = await ensureContributionFromPayment(
      { ...basePayment, status: PaymentStatus.FAILED },
      actor,
    );

    expect(result.contribution).toBeNull();
    expect(mockCreateAutomatedContribution).not.toHaveBeenCalled();
  });

  it("throws when a successful payment has an unmapped payment type", async () => {
    await expect(
      ensureContributionFromPayment(
        { ...basePayment, paymentType: "invalid-type" as PaymentType },
        actor,
      ),
    ).rejects.toBeInstanceOf(PaymentContributionAutomationError);

    expect(mockCreateAutomatedContribution).not.toHaveBeenCalled();
  });

  it("creates special contributions from legacy special payment type aliases", async () => {
    mockCreateAutomatedContribution.mockResolvedValue({
      contribution: {
        ...createdContribution,
        id: "contribution-legacy",
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
      },
      created: true,
    });

    const result = await ensureContributionFromPayment(
      { ...basePayment, paymentType: "special" as PaymentType },
      actor,
    );

    expect(result.outcome).toBe("created");
    expect(mockCreateAutomatedContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        contributionType: ContributionType.SPECIAL_CONTRIBUTION,
      }),
    );
  });

  it("does not re-notify when concurrent create loses and returns existing", async () => {
    mockCreateAutomatedContribution.mockResolvedValue({
      contribution: createdContribution,
      created: false,
    });

    const result = await ensureContributionFromPayment(basePayment, actor);

    expect(result.outcome).toBe("existing");
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(mockNotifyContributionReceived).not.toHaveBeenCalled();
    expect(mockNotifyPaymentRecorded).not.toHaveBeenCalled();
    expect(mockEnsureReceiptFromPayment).toHaveBeenCalled();
  });

  it("concurrent ensureContributionFromPayment calls create once and notify once", async () => {
    const atomicStore = new Map<string, typeof createdContribution>();
    let createCalls = 0;

    mockCreateAutomatedContribution.mockImplementation(
      async (input: {
        paymentReference: string;
        month: number;
        year: number;
        paymentId: string;
      }) => {
        createCalls += 1;
        const id = `${input.paymentReference}_${input.year}-${String(input.month).padStart(2, "0")}`;
        // Yield so both callers enter create before either returns.
        await Promise.resolve();

        if (atomicStore.has(id)) {
          return { contribution: atomicStore.get(id)!, created: false };
        }
        const contribution = {
          ...createdContribution,
          id,
          paymentReference: input.paymentReference,
          paymentId: input.paymentId,
          month: input.month,
          year: input.year,
        };
        atomicStore.set(id, contribution);
        return { contribution, created: true };
      },
    );

    const [first, second] = await Promise.all([
      ensureContributionFromPayment(basePayment, actor),
      ensureContributionFromPayment(basePayment, actor),
    ]);

    expect(atomicStore.size).toBe(1);
    expect(createCalls).toBe(2);

    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["created", "existing"]);
    expect(first.contribution?.id).toBe(second.contribution?.id);
    expect(mockNotifyContributionReceived).toHaveBeenCalledTimes(1);
    expect(mockNotifyPaymentRecorded).toHaveBeenCalledTimes(1);
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
  });
});
