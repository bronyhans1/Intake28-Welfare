import { describe, expect, it } from "vitest";
import { computeExpectedDuesSummary } from "@/lib/finance/expected-dues";
import { computeFinancialSummary } from "@/lib/finance/repository";
import { rowsToCsv, escapeCsvValue } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import { sanitizeReportExportFilters } from "@/lib/reports/export/service";
import { ReportAuditAction } from "@/lib/reports/audit";
import { ReceiptAuditAction } from "@/lib/receipts/audit";
import { canExportReports, canViewReports } from "@/lib/reports/permissions";
import {
  formatAuditActionLabel,
  formatAuditDescription,
} from "@/lib/audit/labels";
import { UserRole } from "@/types/enums";

describe("report permissions", () => {
  it("allows admin and treasurer to view and export reports", () => {
    expect(canViewReports(UserRole.ADMIN)).toBe(true);
    expect(canViewReports(UserRole.TREASURER)).toBe(true);
    expect(canExportReports(UserRole.ADMIN)).toBe(true);
    expect(canExportReports(UserRole.TREASURER)).toBe(true);
  });

  it("denies members access to reports", () => {
    expect(canViewReports(UserRole.MEMBER)).toBe(false);
    expect(canExportReports(UserRole.MEMBER)).toBe(false);
  });
});

describe("financial summary calculations for reports", () => {
  it("combines financial and expected dues summaries", () => {
    const financial = computeFinancialSummary({
      totalContributionAmount: 1200,
      totalSupportAmount: 300,
    });
    const expected = computeExpectedDuesSummary({
      activeMembers: 10,
      monthlyDuesAmount: 50,
      collectedAmount: 400,
    });

    expect(financial.currentBalance).toBe(900);
    expect(expected.expectedAmount).toBe(500);
    expect(expected.outstandingAmount).toBe(100);
    expect(expected.collectionRate).toBe(80);
  });
});

describe("report export filters", () => {
  it("keeps only defined filter values for audit metadata", () => {
    expect(
      sanitizeReportExportFilters({
        month: 6,
        year: 2026,
        memberId: "",
        contributionType: "monthly_dues",
      }),
    ).toEqual({
      month: 6,
      year: 2026,
      contributionType: "monthly_dues",
    });
  });
});

describe("CSV export generation", () => {
  it("escapes values and includes headers", () => {
    const csv = rowsToCsv(
      ["Member", "Amount"],
      [["Mary Baah", "GHS 50.00"], ['Eva "Special", Danso', 200]],
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Member,Amount");
    expect(csv).toContain('"Eva ""Special"", Danso"');
    expect(escapeCsvValue("plain")).toBe("plain");
  });
});

describe("Excel export generation", () => {
  it("creates a non-empty workbook buffer", () => {
    const buffer = rowsToExcelBuffer(
      "Contributions",
      ["Member", "Amount"],
      [["Mary Baah", "GHS 50.00"]],
    );

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("report export audit events", () => {
  it("includes report_exported action label", () => {
    expect(formatAuditActionLabel(ReportAuditAction.REPORT_EXPORTED)).toBe(
      "Report exported",
    );
  });

  it("formats CSV and Excel export descriptions", () => {
    expect(
      formatAuditDescription(ReportAuditAction.REPORT_EXPORTED, {
        reportType: "contributions",
        format: "csv",
      }),
    ).toBe("Contributions Report exported (CSV)");

    expect(
      formatAuditDescription(ReportAuditAction.REPORT_EXPORTED, {
        reportType: "defaulters",
        format: "xlsx",
      }),
    ).toBe("Defaulters Report exported (Excel)");
  });
});

describe("receipt audit events", () => {
  it("includes receipt audit action labels", () => {
    expect(formatAuditActionLabel(ReceiptAuditAction.RECEIPT_GENERATED)).toBe(
      "Receipt generated",
    );
    expect(formatAuditActionLabel(ReceiptAuditAction.RECEIPT_DOWNLOADED)).toBe(
      "Receipt downloaded",
    );
  });

  it("formats receipt audit descriptions", () => {
    expect(
      formatAuditDescription(ReceiptAuditAction.RECEIPT_GENERATED, {
        receiptNumber: "GIS-RCP-20260618-AB1234",
      }),
    ).toBe("Receipt GIS-RCP-20260618-AB1234 generated");

    expect(
      formatAuditDescription(ReceiptAuditAction.RECEIPT_DOWNLOADED, {
        receiptNumber: "GIS-RCP-20260618-AB1234",
      }),
    ).toBe("Receipt GIS-RCP-20260618-AB1234 downloaded");
  });
});
