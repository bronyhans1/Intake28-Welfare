import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReconciliationSummary } from "@/lib/finance/reconciliation";
import {
  ContributionStatus,
  ContributionType,
  PaymentStatus,
  PaymentType,
} from "@/types/enums";
import { ReceiptStatus } from "@/types/receipt";

const mockFetchAllContributionsForReport = vi.fn();
const mockListReceipts = vi.fn();
const mockGetPaymentByReference = vi.fn();

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
}));

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

describe("getReconciliationSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
