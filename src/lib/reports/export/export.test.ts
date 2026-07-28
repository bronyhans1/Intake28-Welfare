import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportContributionsCsv, exportContributionsExcel } from "@/lib/reports/export/contributions";
import { exportDefaultersCsv } from "@/lib/reports/export/defaulters";
import { exportReceiptsCsv, exportReceiptsExcel } from "@/lib/reports/export/receipts";

const mockFetchAllContributionsForReport = vi.fn();
const mockFetchDefaultersForReport = vi.fn();
const mockListReceipts = vi.fn();

vi.mock("@/lib/reports/data", () => ({
  fetchAllContributionsForReport: (...args: unknown[]) =>
    mockFetchAllContributionsForReport(...args),
  fetchAllWelfareSupportForReport: vi.fn().mockResolvedValue([]),
  fetchDefaultersForReport: (...args: unknown[]) =>
    mockFetchDefaultersForReport(...args),
}));

vi.mock("@/lib/receipts/repository", () => ({
  listReceipts: (...args: unknown[]) => mockListReceipts(...args),
}));

describe("contributions export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllContributionsForReport.mockResolvedValue([
      {
        id: "c1",
        contributionType: "monthly_dues",
        memberName: "Mary Baah",
        serviceNumber: "IS/13989",
        amount: 50,
        month: 6,
        year: 2026,
        createdAt: "2026-06-10T00:00:00.000Z",
      },
    ]);
  });

  it("exports filtered contributions as CSV", async () => {
    const file = await exportContributionsCsv({
      month: 6,
      year: 2026,
      contributionType: "monthly_dues",
    });

    expect(mockFetchAllContributionsForReport).toHaveBeenCalledWith({
      month: 6,
      year: 2026,
      memberId: undefined,
      contributionType: "monthly_dues",
    });
    expect(file.filename).toBe("contributions-report-2026-06.csv");
    expect(file.content.toString("utf-8")).toContain("Mary Baah");
    expect(file.content.toString("utf-8")).toContain("Monthly Dues");
  });

  it("exports filtered contributions as Excel", async () => {
    const file = await exportContributionsExcel({ month: 6, year: 2026 });

    expect(file.filename).toBe("contributions-report-2026-06.xlsx");
    expect(file.content.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("defaulters export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDefaultersForReport.mockResolvedValue([
      {
        memberId: "m1",
        fullName: "Mary Baah",
        serviceNumber: "IS/13989",
        outstandingMonths: 2,
        outstandingMonthLabels: ["June 2026", "July 2026"],
        outstandingMonthsDisplay: "June 2026 • July 2026",
        outstandingAmount: 100,
        membershipStatus: "defaulting",
        membershipStatusLabel: "Defaulting",
        lastContributionDate: null,
      },
    ]);
  });

  it("exports defaulters for the target month", async () => {
    const file = await exportDefaultersCsv({ month: 6, year: 2026 });

    expect(mockFetchDefaultersForReport).toHaveBeenCalledWith({
      month: 6,
      year: 2026,
    });
    expect(file.content.toString("utf-8")).toContain("Mary Baah");
    expect(file.content.toString("utf-8")).toContain("June 2026");
    expect(file.content.toString("utf-8")).toContain("GHS 100.00");
  });
});

describe("receipts export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListReceipts.mockResolvedValue({
      records: [
        {
          id: "r1",
          receiptNumber: "GIS-RCP-20260618-AB1234",
          memberName: "Mary Baah",
          serviceNumber: "IS/13989",
          contributionType: "monthly_dues",
          amount: 50,
          currency: "GHS",
          paymentReference: "GIS-20260618-AB1234",
          status: "issued",
          issuedAt: "2026-06-18T10:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10_000,
      totalPages: 1,
    });
  });

  it("exports filtered receipts as CSV", async () => {
    const file = await exportReceiptsCsv({ month: 6, year: 2026 });

    expect(mockListReceipts).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10_000,
      month: 6,
      year: 2026,
    });
    expect(file.filename).toBe("receipts-report-2026-06.csv");
    expect(file.content.toString("utf-8")).toContain("GIS-RCP-20260618-AB1234");
    expect(file.content.toString("utf-8")).toContain("Mary Baah");
  });

  it("exports filtered receipts as Excel", async () => {
    const file = await exportReceiptsExcel({ month: 6, year: 2026 });

    expect(file.filename).toBe("receipts-report-2026-06.xlsx");
    expect(file.content.subarray(0, 2).toString()).toBe("PK");
  });
});
