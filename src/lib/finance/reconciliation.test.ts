import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getReconciliationSummary,
  hubtelBatchPath,
  paystackBatchPath,
  HUBTEL_RECONCILIATION_VERIFY_LIMIT,
  PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS,
  PAYSTACK_RECONCILIATION_VERIFY_LIMIT,
  reconciliationStatusMessage,
} from "@/lib/finance/reconciliation";
import { PAYMENT_ABANDONMENT_HOURS, PAYMENT_ABANDONMENT_MS } from "@/lib/payments/lifecycle";
import {
  ContributionStatus,
  ContributionType,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from "@/types/enums";
import { ReceiptStatus } from "@/types/receipt";

const mockFetchAllContributionsForReport = vi.fn();
const mockListReceipts = vi.fn();
const mockGetPaymentByReference = vi.fn();
const mockLoadPaymentsByReference = vi.fn();

vi.mock("@/lib/reports/data", () => ({
  fetchAllContributionsForReport: (...args: unknown[]) =>
    mockFetchAllContributionsForReport(...args),
}));

vi.mock("@/lib/receipts/repository", () => ({
  listReceipts: (...args: unknown[]) => mockListReceipts(...args),
  getReceiptByPaymentReference: vi.fn(),
}));

vi.mock("@/lib/payments/repository", () => ({
  getPaymentByReference: (...args: unknown[]) => mockGetPaymentByReference(...args),
  loadPaymentsByReference: () => mockLoadPaymentsByReference(),
}));

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockGet = vi.fn();
const mockPaystackVerify = vi.fn();
const mockHubtelStatus = vi.fn();
const mockIsHubtelConfigured = vi.fn();
const mockSettlePayment = vi.fn();
const mockPaymentWrite = vi.fn();

vi.mock("@/lib/integrations/paystack/client", () => ({
  paystackVerifyTransaction: (...args: unknown[]) => mockPaystackVerify(...args),
  PaystackRequestError: class PaystackRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PaystackRequestError";
    }
  },
  PaystackConfigurationError: class PaystackConfigurationError extends Error {
    constructor(message = "Paystack is not configured.") {
      super(message);
      this.name = "PaystackConfigurationError";
    }
  },
}));

vi.mock("@/lib/integrations/hubtel/status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/hubtel/status")>();
  return {
    ...actual,
    hubtelFetchTransactionStatus: (...args: unknown[]) => mockHubtelStatus(...args),
    HubtelStatusRequestError: class HubtelStatusRequestError extends Error {
      readonly retryable: boolean;
      readonly kind: string | null;
      readonly responseCode: string | null;
      readonly httpStatus: number | null;
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
  };
});

const mockPersistHubtelNoRecord = vi.fn();
const mockClearHubtelNoRecord = vi.fn();

vi.mock("@/lib/payments/hubtel-no-record", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments/hubtel-no-record")>();
  return {
    ...actual,
    persistHubtelNoRecordFromStatusError: (...args: unknown[]) =>
      mockPersistHubtelNoRecord(...args),
    clearHubtelNoRecordLookup: (...args: unknown[]) => mockClearHubtelNoRecord(...args),
  };
});

vi.mock("@/lib/integrations/hubtel/checkout-config", () => ({
  isHubtelPaymentConfigured: () => mockIsHubtelConfigured(),
  HubtelPaymentConfigurationError: class HubtelPaymentConfigurationError extends Error {
    constructor(message = "Hubtel Online Checkout is not configured.") {
      super(message);
      this.name = "HubtelPaymentConfigurationError";
    }
  },
}));

vi.mock("@/lib/payments/settlement", () => ({
  settlePaymentFromPaystackReference: (...args: unknown[]) => mockSettlePayment(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

describe("getReconciliationSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsHubtelConfigured.mockReturnValue(false);
    mockCollection.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ get: mockGet });
    mockGet.mockResolvedValue({
      docs: [
        {
          id: "payment-1",
          data: () => ({
            reference: "GIS-20260618-AB1234",
            status: PaymentStatus.SUCCESS,
            memberId: "member-1",
            memberName: "Member User",
            serviceNumber: "IS/00002",
            amount: 50,
            currency: "GHS",
            createdAt: "2026-06-18T10:00:00.000Z",
          }),
        },
      ],
    });
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-1",
        paymentReference: "GIS-20260618-AB1234",
        contributionType: ContributionType.MONTHLY_DUES,
        memberName: "Member User",
        serviceNumber: "IS/00002",
        amount: 50,
        status: ContributionStatus.PAID,
        createdAt: "2026-06-18T10:05:00.000Z",
      },
    ]);
    mockListReceipts.mockResolvedValue({
      records: [
        {
          id: "receipt-1",
          receiptNumber: "GIS-RCP-20260618-AB1234",
          paymentReference: "GIS-20260618-AB1234",
          paymentId: "payment-1",
          contributionId: "contribution-1",
          memberId: "member-1",
          memberName: "Member User",
          serviceNumber: "IS/00002",
          contributionType: ContributionType.MONTHLY_DUES,
          amount: 50,
          currency: "GHS",
          status: ReceiptStatus.ISSUED,
          issuedAt: "2026-06-18T10:05:02.000Z",
          issuedBy: "system",
          createdAt: "2026-06-18T10:05:02.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10_000,
      totalPages: 1,
    });
    mockGetPaymentByReference.mockResolvedValue({
      id: "payment-1",
      reference: "GIS-20260618-AB1234",
      status: PaymentStatus.SUCCESS,
    });
    mockLoadPaymentsByReference.mockResolvedValue(
      new Map([
        [
          "GIS-20260618-AB1234",
          {
            id: "payment-1",
            reference: "GIS-20260618-AB1234",
            status: PaymentStatus.SUCCESS,
          },
        ],
      ]),
    );
  });

  it("returns balanced summary when all records are linked", async () => {
    const summary = await getReconciliationSummary();

    expect(summary.isBalanced).toBe(true);
    expect(summary.paymentsMissingContributions.count).toBe(0);
    expect(summary.contributionsMissingReceipts.count).toBe(0);
    expect(summary.receiptsMissingPayments.count).toBe(0);
  });

  it("detects missing contributions and receipts", async () => {
    mockFetchAllContributionsForReport.mockResolvedValue([]);
    mockListReceipts.mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 10_000,
      totalPages: 0,
    });

    const summary = await getReconciliationSummary();

    expect(summary.isBalanced).toBe(false);
    expect(summary.paymentsMissingContributions.count).toBe(1);
    expect(summary.contributionsMissingReceipts.count).toBe(0);
  });

  it("excludes successful CLAIM_PAYMENT from payments missing contributions", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {
          id: "claim-payment-1",
          data: () => ({
            reference: "GIS-20260823-EWZEDM",
            status: PaymentStatus.SUCCESS,
            paymentType: PaymentType.CLAIM_PAYMENT,
            memberId: "member-1",
            memberName: "Brony Hans",
            serviceNumber: "IS/10002",
            amount: 1250,
            currency: "GHS",
            claimId: "claim-1",
            createdAt: "2026-08-23T10:00:00.000Z",
          }),
        },
      ],
    });
    mockFetchAllContributionsForReport.mockResolvedValue([]);
    mockListReceipts.mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 10_000,
      totalPages: 0,
    });

    const summary = await getReconciliationSummary();

    expect(summary.paymentsMissingContributions.count).toBe(0);
    expect(summary.paymentsMissingContributions.records).toHaveLength(0);
    expect(summary.isBalanced).toBe(true);
  });

  it("still flags contribution payments missing contribution records", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {
          id: "payment-1",
          data: () => ({
            reference: "GIS-20260618-AB1234",
            status: PaymentStatus.SUCCESS,
            paymentType: PaymentType.MONTHLY_DUES,
            memberId: "member-1",
            memberName: "Member User",
            serviceNumber: "IS/00002",
            amount: 50,
            currency: "GHS",
            createdAt: "2026-06-18T10:00:00.000Z",
          }),
        },
      ],
    });
    mockFetchAllContributionsForReport.mockResolvedValue([]);
    mockListReceipts.mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 10_000,
      totalPages: 0,
    });

    const summary = await getReconciliationSummary();

    expect(summary.paymentsMissingContributions.count).toBe(1);
    expect(summary.paymentsMissingContributions.records[0]?.reference).toBe(
      "GIS-20260618-AB1234",
    );
  });

  it("keeps receipt reconciliation unchanged when claim payments are present", async () => {
    mockGet.mockResolvedValue({
      docs: [
        {
          id: "payment-1",
          data: () => ({
            reference: "GIS-20260618-AB1234",
            status: PaymentStatus.SUCCESS,
            paymentType: PaymentType.MONTHLY_DUES,
            memberId: "member-1",
            memberName: "Member User",
            serviceNumber: "IS/00002",
            amount: 50,
            currency: "GHS",
            createdAt: "2026-06-18T10:00:00.000Z",
          }),
        },
        {
          id: "claim-payment-1",
          data: () => ({
            reference: "GIS-20260823-EWZEDM",
            status: PaymentStatus.SUCCESS,
            paymentType: PaymentType.CLAIM_PAYMENT,
            memberId: "member-1",
            memberName: "Brony Hans",
            serviceNumber: "IS/10002",
            amount: 1250,
            currency: "GHS",
            claimId: "claim-1",
            createdAt: "2026-08-23T10:00:00.000Z",
          }),
        },
      ],
    });

    const summary = await getReconciliationSummary();

    expect(summary.isBalanced).toBe(true);
    expect(summary.paymentsMissingContributions.count).toBe(0);
    expect(summary.contributionsMissingReceipts.count).toBe(0);
    expect(summary.receiptsMissingPayments.count).toBe(0);
  });
});

function paystackSuccess(reference: string, overrides: Record<string, unknown> = {}) {
  return {
    status: PaymentStatus.SUCCESS,
    providerReference: reference,
    amount: 5100,
    requestedAmount: 5000,
    fees: 100,
    currency: "GHS",
    paidAt: new Date("2026-10-07T18:56:38.000Z"),
    ...overrides,
  };
}

function portalPayment(overrides: Record<string, unknown>) {
  return {
    id: "payment-candidate",
    reference: "GIS-20261007-LJCA6C",
    status: PaymentStatus.ABANDONED,
    provider: PaymentProvider.PAYSTACK,
    paymentType: PaymentType.MONTHLY_DUES,
    memberId: "member-1",
    memberName: "Member User",
    serviceNumber: "IS/12003",
    amount: 50,
    currency: "GHS",
    selectedMonths: [{ month: 10, year: 2026 }],
    createdAt: "2026-10-07T18:56:06.755Z",
    ...overrides,
  };
}

describe("Paystack unsettled reconciliation", () => {
  const originalPaystackKey = process.env.PAYSTACK_SECRET_KEY;
  let paymentsByStatus: Record<string, Array<Record<string, unknown>>>;

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_reconciliation";
    mockIsHubtelConfigured.mockReturnValue(false);
    paymentsByStatus = {
      [PaymentStatus.SUCCESS]: [],
      [PaymentStatus.ABANDONED]: [],
      [PaymentStatus.PENDING]: [],
      [PaymentStatus.FAILED]: [],
    };
    mockPaystackVerify.mockReset();
    mockHubtelStatus.mockReset();
    mockSettlePayment.mockReset();
    mockPaymentWrite.mockReset();
    mockCollection.mockImplementation(() => ({
      where: (_field: string, _op: string, status: string) => ({
        get: async () => ({
          docs: (paymentsByStatus[status] ?? []).map((payment) => ({
            id: payment.id,
            data: () => payment,
          })),
        }),
      }),
      doc: () => ({
        set: mockPaymentWrite,
        update: mockPaymentWrite,
        create: mockPaymentWrite,
      }),
      add: mockPaymentWrite,
    }));
    mockFetchAllContributionsForReport.mockResolvedValue([]);
    mockListReceipts.mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 10_000,
      totalPages: 0,
    });
    mockGetPaymentByReference.mockResolvedValue(null);
    mockLoadPaymentsByReference.mockResolvedValue(new Map());
  });

  afterEach(() => {
    if (originalPaystackKey === undefined) {
      delete process.env.PAYSTACK_SECRET_KEY;
    } else {
      process.env.PAYSTACK_SECRET_KEY = originalPaystackKey;
    }
  });

  it("flags an abandoned payment when Paystack succeeded and the contribution is missing", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-20261007-LJCA6C"));

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(1);
    expect(summary.unsettledPaystackPayments.records[0]).toMatchObject({
      reference: "GIS-20261007-LJCA6C",
      portalStatus: PaymentStatus.ABANDONED,
      paystackStatus: PaymentStatus.SUCCESS,
      expectedAmount: 50,
      currency: "GHS",
    });
    expect(summary.unsettledPaystackPayments.records[0]?.missingContributions).toContain(
      "October 2026",
    );
    expect(summary.paystackSettlementMismatches.count).toBe(0);
    expect(summary.isBalanced).toBe(false);
    expect(reconciliationStatusMessage(summary)).toBe(
      "One or more financial records need review.",
    );
    expect(reconciliationStatusMessage(summary)).not.toMatch(/aligned/i);
  });

  it("flags a pending payment older than 24 hours when Paystack succeeded", async () => {
    const oldPending = portalPayment({
      id: "pending-old",
      reference: "GIS-OLD-PENDING",
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const freshPending = portalPayment({
      id: "pending-fresh",
      reference: "GIS-FRESH-PENDING",
      status: PaymentStatus.PENDING,
      createdAt: new Date().toISOString(),
    });
    paymentsByStatus[PaymentStatus.PENDING] = [oldPending, freshPending];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-OLD-PENDING"));

    const summary = await getReconciliationSummary();

    expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
    expect(mockPaystackVerify).toHaveBeenCalledWith("GIS-OLD-PENDING");
    expect(summary.unsettledPaystackPayments.records.map((row) => row.reference)).toEqual([
      "GIS-OLD-PENDING",
    ]);
  });

  it("includes pending payments at least 60 minutes old for read-only verification", async () => {
    const eligiblePending = portalPayment({
      id: "pending-60m",
      reference: "GIS-PENDING-60M",
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS).toISOString(),
    });
    paymentsByStatus[PaymentStatus.PENDING] = [eligiblePending];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-PENDING-60M"));

    const summary = await getReconciliationSummary();

    expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
    expect(mockPaystackVerify).toHaveBeenCalledWith("GIS-PENDING-60M");
    expect(summary.unsettledPaystackPayments.records.map((row) => row.reference)).toEqual([
      "GIS-PENDING-60M",
    ]);
    expect(summary.paystackSurplusDuplicatePayments.count).toBe(0);
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("excludes pending payments younger than 60 minutes from verification", async () => {
    const youngPending = portalPayment({
      id: "pending-young",
      reference: "GIS-PENDING-YOUNG",
      status: PaymentStatus.PENDING,
      createdAt: new Date(
        Date.now() - (PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS - 60_000),
      ).toISOString(),
    });
    paymentsByStatus[PaymentStatus.PENDING] = [youngPending];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-PENDING-YOUNG"));

    const summary = await getReconciliationSummary();

    expect(mockPaystackVerify).not.toHaveBeenCalled();
    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackCandidateWindow.candidateCount).toBe(0);
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("keeps the 24-hour abandonment policy unchanged and does not abandon during reconciliation", async () => {
    expect(PAYMENT_ABANDONMENT_HOURS).toBe(24);
    expect(PAYMENT_ABANDONMENT_MS).toBe(24 * 60 * 60 * 1000);
    expect(PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS).toBe(60 * 60 * 1000);
    expect(PAYSTACK_RECONCILIATION_PENDING_VERIFY_MS).toBeLessThan(PAYMENT_ABANDONMENT_MS);
    expect(PAYSTACK_RECONCILIATION_VERIFY_LIMIT).toBe(20);

    const midAgePending = portalPayment({
      id: "pending-2h",
      reference: "GIS-PENDING-2H",
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    paymentsByStatus[PaymentStatus.PENDING] = [midAgePending];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-PENDING-2H"));

    await getReconciliationSummary();

    expect(mockPaystackVerify).toHaveBeenCalledWith("GIS-PENDING-2H");
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("reports a Paystack success as surplus when the period is already PAID on another reference", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        id: "surplus-payment",
        reference: "GIS-SURPLUS-OCT",
        memberId: "member-dup",
        serviceNumber: "IS/12304",
        selectedMonths: [{ month: 10, year: 2026 }],
      }),
    ];
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-recorded",
        paymentReference: "GIS-RECORDED-OCT",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        memberId: "member-dup",
        memberName: "Member User",
        serviceNumber: "IS/12304",
        amount: 50,
        month: 10,
        year: 2026,
      },
    ]);
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-SURPLUS-OCT"));

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackSurplusDuplicatePayments.count).toBe(1);
    expect(summary.paystackSurplusDuplicatePayments.records[0]).toMatchObject({
      reference: "GIS-SURPLUS-OCT",
      memberId: "member-dup",
      serviceNumber: "IS/12304",
      portalStatus: PaymentStatus.ABANDONED,
      paystackStatus: PaymentStatus.SUCCESS,
      expectedAmount: 50,
      currency: "GHS",
      periodLabel: "October 2026",
      existingPaymentReference: "GIS-RECORDED-OCT",
    });
    expect(summary.isBalanced).toBe(false);
    expect(reconciliationStatusMessage(summary)).toBe(
      "One or more financial records need review.",
    );
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("does not classify a different member or different period as a surplus duplicate", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        id: "candidate-a",
        reference: "GIS-OTHER-MEMBER",
        memberId: "member-a",
        serviceNumber: "IS/12511",
        selectedMonths: [{ month: 10, year: 2026 }],
      }),
    ];
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-other-member",
        paymentReference: "GIS-OTHER-RECORDED",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        memberId: "member-b",
        amount: 50,
        month: 10,
        year: 2026,
      },
      {
        id: "contribution-other-period",
        paymentReference: "GIS-SEP-RECORDED",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        memberId: "member-a",
        amount: 50,
        month: 9,
        year: 2026,
      },
    ]);
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-OTHER-MEMBER"));

    const summary = await getReconciliationSummary();

    expect(summary.paystackSurplusDuplicatePayments.count).toBe(0);
    expect(summary.unsettledPaystackPayments.count).toBe(1);
    expect(summary.unsettledPaystackPayments.records[0]?.reference).toBe("GIS-OTHER-MEMBER");
  });

  it("does not treat a same-reference contribution as a surplus duplicate", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        id: "same-ref",
        reference: "GIS-SAME-REF",
        memberId: "member-same",
        selectedMonths: [{ month: 10, year: 2026 }],
      }),
    ];
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-same-ref",
        paymentReference: "GIS-SAME-REF",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        memberId: "member-same",
        amount: 50,
        month: 10,
        year: 2026,
      },
    ]);
    mockListReceipts.mockResolvedValue({
      records: [
        {
          id: "receipt-same-ref",
          receiptNumber: "GIS-RCP-SAME-REF",
          paymentReference: "GIS-SAME-REF",
          contributionId: "contribution-same-ref",
          memberId: "member-same",
          amount: 50,
          currency: "GHS",
          status: ReceiptStatus.ISSUED,
          createdAt: "2026-10-14T13:22:33.868Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10_000,
      totalPages: 1,
    });
    mockLoadPaymentsByReference.mockResolvedValue(
      new Map([
        [
          "GIS-SAME-REF",
          {
            id: "same-ref",
            reference: "GIS-SAME-REF",
            status: PaymentStatus.SUCCESS,
          },
        ],
      ]),
    );
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-SAME-REF"));

    const summary = await getReconciliationSummary();

    expect(summary.paystackSurplusDuplicatePayments.count).toBe(0);
    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.isBalanced).toBe(true);
  });

  it("does not flag an abandoned payment when Paystack verification fails", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockRejectedValue(new Error("Failed to verify Paystack payment."));

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackSettlementMismatches.count).toBe(0);
    expect(summary.paystackVerificationLimitations.count).toBe(1);
    expect(summary.paystackVerificationLimitations.records[0]?.reason).toBe("error");
    expect(summary.isBalanced).toBe(true);
    expect(reconciliationStatusMessage(summary)).toMatch(/could not be verified/i);
  });

  it("does not flag payments Paystack reports as failed or abandoned", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({ id: "failed", reference: "GIS-FAILED" }),
      portalPayment({ id: "abandoned", reference: "GIS-ABANDONED" }),
    ];
    mockPaystackVerify.mockImplementation(async (reference: string) =>
      paystackSuccess(reference, {
        status: reference === "GIS-FAILED" ? PaymentStatus.FAILED : PaymentStatus.ABANDONED,
        paidAt: null,
      }),
    );

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackSettlementMismatches.count).toBe(0);
    expect(summary.paystackVerificationLimitations.count).toBe(0);
  });

  it("does not flag an already settled payment", async () => {
    paymentsByStatus[PaymentStatus.SUCCESS] = [
      portalPayment({
        id: "settled",
        reference: "GIS-SETTLED",
        status: PaymentStatus.SUCCESS,
      }),
    ];
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        id: "settled-copy",
        reference: "GIS-SETTLED",
        status: PaymentStatus.SUCCESS,
      }),
    ];

    const summary = await getReconciliationSummary();

    expect(mockPaystackVerify).not.toHaveBeenCalled();
    expect(summary.unsettledPaystackPayments.count).toBe(0);
  });

  it("reports amount and currency mismatches separately from recoverable payments", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({ id: "amount", reference: "GIS-AMOUNT" }),
      portalPayment({ id: "currency", reference: "GIS-CURRENCY" }),
    ];
    mockPaystackVerify.mockImplementation(async (reference: string) => {
      if (reference === "GIS-AMOUNT") {
        return paystackSuccess(reference, { requestedAmount: 4000, fees: null, amount: 4000 });
      }
      return paystackSuccess(reference, { currency: "USD" });
    });

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackSettlementMismatches.records.map((row) => row.issue).sort()).toEqual([
      "amount",
      "currency",
    ]);
    expect(summary.isBalanced).toBe(false);
    expect(reconciliationStatusMessage(summary)).not.toMatch(/aligned/i);
  });

  it("flags a multi-month payment when only some contributions are recorded", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        reference: "GIS-MULTI",
        amount: 100,
        selectedMonths: [
          { month: 8, year: 2026 },
          { month: 9, year: 2026 },
        ],
      }),
    ];
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-aug",
        paymentReference: "GIS-MULTI",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        month: 8,
        year: 2026,
        memberName: "Member User",
        amount: 50,
      },
    ]);
    mockPaystackVerify.mockResolvedValue(
      paystackSuccess("GIS-MULTI", { amount: 10100, requestedAmount: 10000, fees: 100 }),
    );

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(1);
    expect(summary.unsettledPaystackPayments.records[0]?.missingContributions).toContain(
      "September 2026",
    );
    expect(summary.unsettledPaystackPayments.records[0]?.missingContributions).not.toContain(
      "August 2026",
    );
  });

  it("records Paystack timeouts and rate limits without treating them as mismatches", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({ id: "timeout", reference: "GIS-TIMEOUT" }),
      portalPayment({ id: "rate", reference: "GIS-RATE" }),
      portalPayment({ id: "later", reference: "GIS-LATER" }),
    ];
    mockPaystackVerify.mockImplementation(async (reference: string) => {
      if (reference === "GIS-TIMEOUT") {
        throw new Error("Paystack verification timed out.");
      }
      throw new Error("Too many requests");
    });

    const summary = await getReconciliationSummary();

    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.paystackSettlementMismatches.count).toBe(0);
    expect(summary.paystackVerificationLimitations.records.map((row) => row.reason)).toEqual([
      "timeout",
      "rate_limit",
      "rate_limit",
    ]);
    expect(mockPaystackVerify).toHaveBeenCalledTimes(2);
    expect(mockPaystackVerify).not.toHaveBeenCalledWith("GIS-LATER");
    expect(summary.isBalanced).toBe(true);
  });

  it("does not write payments or call settlement", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-20261007-LJCA6C"));

    await getReconciliationSummary();

    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("keeps the original three reconciliation checks unchanged", async () => {
    paymentsByStatus[PaymentStatus.SUCCESS] = [
      portalPayment({
        id: "success-gap",
        reference: "GIS-SUCCESS-GAP",
        status: PaymentStatus.SUCCESS,
      }),
    ];
    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-20261007-LJCA6C"));

    const summary = await getReconciliationSummary();

    expect(summary.paymentsMissingContributions.count).toBe(1);
    expect(summary.paymentsMissingContributions.records[0]?.reference).toBe("GIS-SUCCESS-GAP");
    expect(summary.contributionsMissingReceipts.count).toBe(0);
    expect(summary.receiptsMissingPayments.count).toBe(0);
    expect(summary.unsettledPaystackPayments.count).toBe(1);
    expect(summary.isBalanced).toBe(false);
  });

  it("pages Paystack candidates in batches of 20 without starving later payments", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = Array.from({ length: 25 }, (_, index) =>
      portalPayment({
        id: `batch-${index}`,
        reference: `GIS-BATCH-${String(index).padStart(2, "0")}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      }),
    );
    mockPaystackVerify.mockImplementation(async (reference: string) =>
      paystackSuccess(reference, { status: PaymentStatus.FAILED, paidAt: null }),
    );

    const first = await getReconciliationSummary({ paystackBatch: 1 });
    const second = await getReconciliationSummary({ paystackBatch: "2" });
    const invalid = await getReconciliationSummary({ paystackBatch: "-4" });
    const zero = await getReconciliationSummary({ paystackBatch: "0" });
    const malformed = await getReconciliationSummary({ paystackBatch: "nope" });
    const pastEnd = await getReconciliationSummary({ paystackBatch: "99" });

    const verified = (batch: "first" | "second") =>
      mockPaystackVerify.mock.calls
        .map((call) => call[0])
        .filter((_, index) => (batch === "first" ? index < 20 : index >= 20 && index < 25));

    expect(first.paystackCandidateWindow).toMatchObject({
      batch: 1,
      batchCount: 2,
      candidateCount: 25,
      rangeStart: 1,
      rangeEnd: 20,
      hasPrevious: false,
      hasNext: true,
      uncheckedCount: 5,
      requestedBatchAdjusted: false,
    });
    expect(first.paystackVerificationLimitations.records.some((row) => row.reason === "not_checked")).toBe(
      true,
    );
    expect(first.isBalanced).toBe(true);
    expect(verified("first")).toEqual(
      Array.from({ length: 20 }, (_, index) => `GIS-BATCH-${String(index).padStart(2, "0")}`),
    );
    expect(verified("first")).not.toContain("GIS-BATCH-24");

    expect(second.paystackCandidateWindow).toMatchObject({
      batch: 2,
      rangeStart: 21,
      rangeEnd: 25,
      hasPrevious: true,
      hasNext: false,
      uncheckedCount: 20,
    });
    expect(second.paystackCandidateWindow.requestedBatchAdjusted).toBe(false);
    expect(mockPaystackVerify.mock.calls.slice(20, 25).map((call) => call[0])).toEqual([
      "GIS-BATCH-20",
      "GIS-BATCH-21",
      "GIS-BATCH-22",
      "GIS-BATCH-23",
      "GIS-BATCH-24",
    ]);

    expect(invalid.paystackCandidateWindow.batch).toBe(1);
    expect(invalid.paystackCandidateWindow.requestedBatchAdjusted).toBe(true);
    expect(zero.paystackCandidateWindow.batch).toBe(1);
    expect(zero.paystackCandidateWindow.requestedBatchAdjusted).toBe(true);
    expect(malformed.paystackCandidateWindow.batch).toBe(1);
    expect(malformed.paystackCandidateWindow.requestedBatchAdjusted).toBe(true);
    expect(pastEnd.paystackCandidateWindow.batch).toBe(2);
    expect(pastEnd.paystackCandidateWindow.requestedBatchAdjusted).toBe(true);
    expect(pastEnd.paystackCandidateWindow.rangeStart).toBe(21);

    expect(paystackBatchPath(first.paystackCandidateWindow.batch + 1)).toBe(
      "/admin/finance/reconciliation?paystackBatch=2",
    );
    expect(paystackBatchPath(second.paystackCandidateWindow.batch - 1)).toBe(
      "/admin/finance/reconciliation",
    );
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("classifies every receipt from one payment map while Paystack verification runs", async () => {
    let releasePayments: (payments: Map<string, { reference: string; status: PaymentStatus }>) => void =
      () => undefined;
    const paymentsReady = new Promise<Map<string, { reference: string; status: PaymentStatus }>>(
      (resolve) => {
        releasePayments = resolve;
      },
    );
    mockLoadPaymentsByReference.mockClear();
    mockFetchAllContributionsForReport.mockClear();
    mockGetPaymentByReference.mockClear();
    mockLoadPaymentsByReference.mockReturnValue(paymentsReady);
    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-20261007-LJCA6C"));
    mockListReceipts.mockResolvedValue({
      records: [
        {
          id: "receipt-ok",
          receiptNumber: "GIS-RCP-OK",
          paymentReference: "GIS-OK",
          memberName: "Member User",
        },
        {
          id: "receipt-failed",
          receiptNumber: "GIS-RCP-FAILED",
          paymentReference: "GIS-FAILED",
          memberName: "Member User",
        },
        {
          id: "receipt-missing",
          receiptNumber: "GIS-RCP-MISSING",
          paymentReference: "GIS-MISSING",
          memberName: "Member User",
        },
      ],
      total: 3,
      page: 1,
      pageSize: 10_000,
      totalPages: 1,
    });

    const pendingSummary = getReconciliationSummary();
    await vi.waitFor(() => {
      expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
    });

    releasePayments(
      new Map([
        ["GIS-OK", { reference: "GIS-OK", status: PaymentStatus.SUCCESS }],
        ["GIS-FAILED", { reference: "GIS-FAILED", status: PaymentStatus.FAILED }],
      ]),
    );

    const summary = await pendingSummary;

    expect(mockGetPaymentByReference).not.toHaveBeenCalled();
    expect(mockLoadPaymentsByReference).toHaveBeenCalledTimes(1);
    expect(mockFetchAllContributionsForReport).toHaveBeenCalledTimes(1);
    expect(summary.receiptsMissingPayments.records.map((receipt) => receipt.paymentReference)).toEqual([
      "GIS-FAILED",
      "GIS-MISSING",
    ]);
    expect(summary.receiptsMissingPayments.count).toBe(2);
    expect(summary.unsettledPaystackPayments.count).toBe(1);
    expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
    expect(summary.isBalanced).toBe(false);
  });

  it("reports a failed overlapped read without dropping the Paystack error or leaving a rejection unhandled", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    paymentsByStatus[PaymentStatus.ABANDONED] = [portalPayment({})];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-20261007-LJCA6C"));
    mockFetchAllContributionsForReport.mockRejectedValue(new Error("contributions read failed"));

    try {
      await expect(getReconciliationSummary()).rejects.toThrow("contributions read failed");
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
      expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
      expect(mockSettlePayment).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("Hubtel unsettled reconciliation", () => {
  const originalPaystackKey = process.env.PAYSTACK_SECRET_KEY;
  let paymentsByStatus: Record<string, Array<Record<string, unknown>>>;

  function hubtelSuccess(reference: string, overrides: Record<string, unknown> = {}) {
    return {
      status: PaymentStatus.SUCCESS,
      lifecycleStatus: "Paid",
      clientReference: reference,
      providerReference: `HT-${reference}`,
      amount: 51,
      currency: "GHS",
      paidAt: new Date("2026-10-07T18:56:38.000Z"),
      rawStatus: "Paid",
      ...overrides,
    };
  }

  function hubtelPortalPayment(overrides: Record<string, unknown> = {}) {
    return {
      id: "hubtel-candidate",
      reference: "GIS-HUBTEL-001",
      status: PaymentStatus.ABANDONED,
      provider: PaymentProvider.HUBTEL,
      paymentType: PaymentType.MONTHLY_DUES,
      memberId: "member-1",
      memberName: "Member User",
      serviceNumber: "IS/12003",
      amount: 50,
      checkoutAmount: 51,
      processingFeeAmount: 1,
      currency: "GHS",
      selectedMonths: [{ month: 10, year: 2026 }],
      createdAt: "2026-10-07T18:56:06.755Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
    mockIsHubtelConfigured.mockReturnValue(true);
    paymentsByStatus = {
      [PaymentStatus.SUCCESS]: [],
      [PaymentStatus.ABANDONED]: [],
      [PaymentStatus.PENDING]: [],
      [PaymentStatus.FAILED]: [],
    };
    mockPaystackVerify.mockReset();
    mockHubtelStatus.mockReset();
    mockSettlePayment.mockReset();
    mockPaymentWrite.mockReset();
    mockPersistHubtelNoRecord.mockReset().mockResolvedValue(undefined);
    mockClearHubtelNoRecord.mockReset().mockResolvedValue(undefined);
    mockCollection.mockImplementation(() => ({
      where: (_field: string, _op: string, status: string) => ({
        get: async () => ({
          docs: (paymentsByStatus[status] ?? []).map((payment) => ({
            id: payment.id,
            data: () => payment,
          })),
        }),
      }),
      doc: () => ({
        set: mockPaymentWrite,
        update: mockPaymentWrite,
        create: mockPaymentWrite,
      }),
      add: mockPaymentWrite,
    }));
    mockFetchAllContributionsForReport.mockResolvedValue([]);
    mockListReceipts.mockResolvedValue({
      records: [],
      total: 0,
      page: 1,
      pageSize: 10_000,
      totalPages: 0,
    });
    mockGetPaymentByReference.mockResolvedValue(null);
    mockLoadPaymentsByReference.mockResolvedValue(new Map());
  });

  afterEach(() => {
    if (originalPaystackKey === undefined) {
      delete process.env.PAYSTACK_SECRET_KEY;
    } else {
      process.env.PAYSTACK_SECRET_KEY = originalPaystackKey;
    }
  });

  it("flags an abandoned Hubtel payment when Hubtel succeeded and the contribution is missing", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [hubtelPortalPayment()];
    mockHubtelStatus.mockResolvedValue(hubtelSuccess("GIS-HUBTEL-001"));

    const summary = await getReconciliationSummary();

    expect(summary.unsettledHubtelPayments.count).toBe(1);
    expect(summary.unsettledHubtelPayments.records[0]).toMatchObject({
      reference: "GIS-HUBTEL-001",
      portalStatus: PaymentStatus.ABANDONED,
      hubtelStatus: PaymentStatus.SUCCESS,
      expectedAmount: 50,
      expectedCheckoutAmount: 51,
      currency: "GHS",
    });
    expect(summary.unsettledHubtelPayments.records[0]?.missingContributions).toContain(
      "October 2026",
    );
    expect(summary.unsettledPaystackPayments.count).toBe(0);
    expect(summary.isBalanced).toBe(false);
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("does not flag Hubtel payments that failed, pending, or mismatched checkout amount", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      hubtelPortalPayment({ id: "failed", reference: "GIS-HT-FAILED" }),
      hubtelPortalPayment({ id: "pending", reference: "GIS-HT-PENDING" }),
      hubtelPortalPayment({ id: "mismatch", reference: "GIS-HT-MISMATCH" }),
    ];
    mockHubtelStatus.mockImplementation(async (reference: string) => {
      if (reference === "GIS-HT-FAILED") {
        return hubtelSuccess(reference, { status: PaymentStatus.FAILED, lifecycleStatus: "Failed" });
      }
      if (reference === "GIS-HT-PENDING") {
        return hubtelSuccess(reference, {
          status: PaymentStatus.PENDING,
          lifecycleStatus: "Pending",
        });
      }
      return hubtelSuccess(reference, { amount: 40 });
    });

    const summary = await getReconciliationSummary();

    expect(summary.unsettledHubtelPayments.count).toBe(0);
    expect(summary.hubtelSettlementMismatches.records.map((row) => row.issue)).toEqual([
      "amount",
    ]);
    expect(summary.hubtelSettlementMismatches.records[0]).toMatchObject({
      reference: "GIS-HT-MISMATCH",
      expectedAmount: 50,
      expectedCheckoutAmount: 51,
    });
    expect(mockSettlePayment).not.toHaveBeenCalled();
  });

  it("handles Paystack and Hubtel candidates in the same summary without cross-provider verify", async () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_reconciliation";
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      portalPayment({
        id: "paystack-abandoned",
        reference: "GIS-PS-001",
        provider: PaymentProvider.PAYSTACK,
      }),
      hubtelPortalPayment({
        id: "hubtel-abandoned",
        reference: "GIS-HT-001",
      }),
    ];
    mockPaystackVerify.mockResolvedValue(paystackSuccess("GIS-PS-001"));
    mockHubtelStatus.mockResolvedValue(hubtelSuccess("GIS-HT-001"));

    const summary = await getReconciliationSummary();

    expect(mockPaystackVerify).toHaveBeenCalledTimes(1);
    expect(mockPaystackVerify).toHaveBeenCalledWith("GIS-PS-001");
    expect(mockHubtelStatus).toHaveBeenCalledTimes(1);
    expect(mockHubtelStatus).toHaveBeenCalledWith("GIS-HT-001");
    expect(summary.unsettledPaystackPayments.records.map((row) => row.reference)).toEqual([
      "GIS-PS-001",
    ]);
    expect(summary.unsettledHubtelPayments.records.map((row) => row.reference)).toEqual([
      "GIS-HT-001",
    ]);
    expect(summary.isBalanced).toBe(false);
  });

  it("reports Hubtel surplus when the period is already PAID on another reference", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      hubtelPortalPayment({
        id: "surplus-hubtel",
        reference: "GIS-HT-SURPLUS",
        memberId: "member-dup",
        serviceNumber: "IS/12304",
      }),
    ];
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "contribution-recorded",
        paymentReference: "GIS-RECORDED-OCT",
        contributionType: ContributionType.MONTHLY_DUES,
        status: ContributionStatus.PAID,
        memberId: "member-dup",
        memberName: "Member User",
        serviceNumber: "IS/12304",
        amount: 50,
        month: 10,
        year: 2026,
      },
    ]);
    mockHubtelStatus.mockResolvedValue(hubtelSuccess("GIS-HT-SURPLUS"));

    const summary = await getReconciliationSummary();

    expect(summary.unsettledHubtelPayments.count).toBe(0);
    expect(summary.hubtelSurplusDuplicatePayments.count).toBe(1);
    expect(summary.hubtelSurplusDuplicatePayments.records[0]).toMatchObject({
      reference: "GIS-HT-SURPLUS",
      expectedAmount: 50,
      expectedCheckoutAmount: 51,
      existingPaymentReference: "GIS-RECORDED-OCT",
    });
    expect(summary.isBalanced).toBe(false);
  });

  it("pages Hubtel candidates independently of Paystack batches", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = Array.from({ length: 25 }, (_, index) =>
      hubtelPortalPayment({
        id: `ht-batch-${index}`,
        reference: `GIS-HT-BATCH-${String(index).padStart(2, "0")}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      }),
    );
    mockHubtelStatus.mockImplementation(async (reference: string) =>
      hubtelSuccess(reference, { status: PaymentStatus.FAILED, lifecycleStatus: "Failed" }),
    );

    const first = await getReconciliationSummary({ hubtelBatch: 1 });
    const second = await getReconciliationSummary({ hubtelBatch: "2" });

    expect(HUBTEL_RECONCILIATION_VERIFY_LIMIT).toBe(20);
    expect(first.hubtelCandidateWindow).toMatchObject({
      batch: 1,
      batchCount: 2,
      candidateCount: 25,
      rangeStart: 1,
      rangeEnd: 20,
      hasNext: true,
      uncheckedCount: 5,
    });
    expect(second.hubtelCandidateWindow).toMatchObject({
      batch: 2,
      rangeStart: 21,
      rangeEnd: 25,
      hasPrevious: true,
      hasNext: false,
    });
    expect(hubtelBatchPath(2, 3)).toBe(
      "/admin/finance/reconciliation?paystackBatch=3&hubtelBatch=2",
    );
    expect(mockSettlePayment).not.toHaveBeenCalled();
  });

  it("does not write payments or call settlement during Hubtel reconciliation", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [hubtelPortalPayment()];
    mockHubtelStatus.mockResolvedValue(hubtelSuccess("GIS-HUBTEL-001"));

    await getReconciliationSummary();

    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
  });

  it("classifies Hubtel 4720 no-record without settling or unbalancing", async () => {
    const { HubtelStatusRequestError } = await import("@/lib/integrations/hubtel/status");
    paymentsByStatus[PaymentStatus.ABANDONED] = [hubtelPortalPayment()];
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError(
        "Your status check did not match any records or your reference is older than a month, please check your request and try again.",
        {
          retryable: false,
          kind: "no_record",
          responseCode: "4720",
          httpStatus: 400,
        },
      ),
    );

    const summary = await getReconciliationSummary();

    expect(summary.hubtelVerificationLimitations.count).toBe(1);
    expect(summary.hubtelVerificationLimitations.records[0]).toMatchObject({
      reference: "GIS-HUBTEL-001",
      reason: "no_record",
    });
    expect(summary.unsettledHubtelPayments.count).toBe(0);
    expect(summary.hubtelSettlementMismatches.count).toBe(0);
    expect(summary.isBalanced).toBe(true);
    expect(mockSettlePayment).not.toHaveBeenCalled();
    expect(mockPaymentWrite).not.toHaveBeenCalled();
    expect(mockPersistHubtelNoRecord).toHaveBeenCalledTimes(1);
    expect(mockHubtelStatus).toHaveBeenCalledTimes(1);
  });

  it("skips automatic Hubtel lookup while a recent no-record marker is present", async () => {
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      hubtelPortalPayment({
        hubtelNoRecordCheckedAt: new Date().toISOString(),
        hubtelNoRecordResponseCode: "4720",
      }),
    ];

    const first = await getReconciliationSummary();
    const second = await getReconciliationSummary();

    expect(mockHubtelStatus).not.toHaveBeenCalled();
    expect(first.hubtelVerificationLimitations.records[0]?.reason).toBe("no_record");
    expect(second.hubtelVerificationLimitations.records[0]?.reason).toBe("no_record");
    expect(first.isBalanced).toBe(true);
    expect(mockPersistHubtelNoRecord).not.toHaveBeenCalled();
  });

  it("allows authorized Hubtel force recheck to bypass no-record suppression", async () => {
    const { HubtelStatusRequestError } = await import("@/lib/integrations/hubtel/status");
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      hubtelPortalPayment({
        hubtelNoRecordCheckedAt: new Date().toISOString(),
        hubtelNoRecordResponseCode: "4720",
      }),
    ];
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError("still missing", {
        retryable: false,
        kind: "no_record",
        responseCode: "4720",
        httpStatus: 400,
      }),
    );

    const summary = await getReconciliationSummary({ hubtelForceRecheck: "1" });

    expect(mockHubtelStatus).toHaveBeenCalledTimes(1);
    expect(summary.hubtelVerificationLimitations.records[0]?.reason).toBe("no_record");
    expect(mockPersistHubtelNoRecord).toHaveBeenCalledWith(
      "GIS-HUBTEL-001",
      expect.objectContaining({ kind: "no_record" }),
      "reconciliation_recheck",
    );
    expect(summary.isBalanced).toBe(true);
  });

  it("keeps unrelated Hubtel HTTP errors as generic verification errors", async () => {
    const { HubtelStatusRequestError } = await import("@/lib/integrations/hubtel/status");
    paymentsByStatus[PaymentStatus.ABANDONED] = [hubtelPortalPayment()];
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError("Merchant account is invalid.", {
        retryable: false,
        kind: "http",
        responseCode: "4000",
        httpStatus: 400,
      }),
    );

    const summary = await getReconciliationSummary();

    expect(summary.hubtelVerificationLimitations.records[0]?.reason).toBe("error");
    expect(mockPersistHubtelNoRecord).not.toHaveBeenCalled();
    expect(summary.isBalanced).toBe(true);
  });

  it("preserves Hubtel rate-limit stop behavior", async () => {
    const { HubtelStatusRequestError } = await import("@/lib/integrations/hubtel/status");
    paymentsByStatus[PaymentStatus.ABANDONED] = [
      hubtelPortalPayment({ id: "a", reference: "GIS-HT-A", createdAt: "2026-10-01T00:00:00.000Z" }),
      hubtelPortalPayment({ id: "b", reference: "GIS-HT-B", createdAt: "2026-10-01T00:01:00.000Z" }),
    ];
    mockHubtelStatus.mockRejectedValue(
      new HubtelStatusRequestError("too many requests", {
        retryable: true,
        kind: "http",
        httpStatus: 429,
      }),
    );

    const summary = await getReconciliationSummary();

    expect(mockHubtelStatus).toHaveBeenCalledTimes(1);
    expect(summary.hubtelVerificationLimitations.records.map((row) => row.reason)).toEqual([
      "rate_limit",
      "rate_limit",
    ]);
  });
});

describe("reconciliation server/client boundary", () => {
  const overviewSource = readFileSync(
    join(process.cwd(), "src/components/admin/reconciliation-overview.tsx"),
    "utf8",
  );
  const viewSource = readFileSync(
    join(process.cwd(), "src/lib/finance/reconciliation-view.ts"),
    "utf8",
  );
  const pageSource = readFileSync(
    join(process.cwd(), "src/app/admin/finance/reconciliation/page.tsx"),
    "utf8",
  );
  const serverSource = readFileSync(
    join(process.cwd(), "src/lib/finance/reconciliation.ts"),
    "utf8",
  );

  it("keeps the overview off the server reconciliation module", () => {
    expect(overviewSource).toContain("@/lib/finance/reconciliation-view");
    expect(overviewSource).not.toContain("@/lib/finance/reconciliation\"");
    expect(overviewSource).not.toContain("@/lib/firebase/admin");
    expect(overviewSource).not.toContain("paystackVerifyTransaction");
    expect(overviewSource).not.toContain("hubtelFetchTransactionStatus");
    expect(overviewSource).not.toContain("settlePaymentFromPaystackReference");
  });

  it("keeps Firebase Admin and provider verification out of the view module", () => {
    expect(viewSource).not.toContain("firebase/admin");
    expect(viewSource).not.toContain("firebase-admin");
    expect(viewSource).not.toContain("paystackVerifyTransaction");
    expect(viewSource).not.toContain("hubtelFetchTransactionStatus");
    expect(viewSource).not.toContain("PAYSTACK_SECRET_KEY");
    expect(viewSource).not.toContain("settlePaymentFromPaystackReference");
  });

  it("authorizes on the server before loading the reconciliation summary", () => {
    const authIndex = pageSource.indexOf("canViewReconciliation");
    const summaryIndex = pageSource.indexOf("getReconciliationSummary");
    expect(authIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(authIndex);
    expect(pageSource).toContain('redirect("/admin/dashboard")');
    expect(pageSource).toContain("hubtelBatch");
    expect(pageSource).toContain("hubtelRecheck");
    expect(pageSource).toContain("confirmed payment, contribution, and receipt discrepancies");
    expect(serverSource).not.toContain("settlePaymentFromPaystackReference");
    expect(serverSource).not.toContain("abandonStalePendingPayments");
    expect(serverSource).not.toContain(".update(");
    expect(serverSource).not.toContain(".set(");
  });

  it("keeps surplus duplicate review read-only in the overview", () => {
    expect(overviewSource).toContain("Potential Surplus Or Duplicate Paystack Charges");
    expect(overviewSource).toContain("Potential Surplus Or Duplicate Hubtel Charges");
    expect(overviewSource).toContain("not settle or refund payments");
    expect(overviewSource).not.toContain("settlePayment");
    expect(overviewSource).not.toMatch(/\bRefund\b/);
  });

  it("exposes recovery only for unsettled successes, not surplus or limitations", () => {
    expect(overviewSource).toContain("RecoverUnsettledPaymentButton");
    expect(overviewSource).toContain("Unsettled Hubtel Successes");
    const paystackUnsettledIdx = overviewSource.indexOf("Unsettled Paystack Successes");
    const hubtelUnsettledIdx = overviewSource.indexOf("Unsettled Hubtel Successes");
    const paystackSurplusIdx = overviewSource.indexOf(
      "Potential Surplus Or Duplicate Paystack Charges",
    );
    const recoverIdx = overviewSource.indexOf("<RecoverUnsettledPaymentButton");
    expect(recoverIdx).toBeGreaterThan(paystackUnsettledIdx);
    expect(recoverIdx).toBeLessThan(paystackSurplusIdx);
    expect(hubtelUnsettledIdx).toBeGreaterThan(paystackUnsettledIdx);
    expect(hubtelUnsettledIdx).toBeLessThan(paystackSurplusIdx);
  });
});
