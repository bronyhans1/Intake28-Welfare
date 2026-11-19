import { formatReceiptContributionTypeLabel, formatReceiptStatusLabel } from "@/lib/receipts/labels";
import { listReceipts } from "@/lib/receipts/repository";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat, ReportExportFilters } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedReceipt } from "@/types/receipt";

const HEADERS = [
  "Receipt Number",
  "Member",
  "Service Number",
  "Contribution Type",
  "Amount",
  "Payment Reference",
  "Status",
  "Date Issued",
];

async function fetchAllReceiptsForReport(
  filters: ReportExportFilters,
): Promise<SerializedReceipt[]> {
  const result = await listReceipts({
    page: 1,
    pageSize: 10_000,
    month: filters.month,
    year: filters.year,
  });

  let records = result.records;
  if (filters.memberId) {
    records = records.filter((record) => record.memberId === filters.memberId);
  }

  return records;
}

function mapReceiptRows(records: SerializedReceipt[]) {
  return records.map((record) => [
    record.receiptNumber,
    record.memberName,
    record.serviceNumber,
    formatReceiptContributionTypeLabel(record.contributionType),
    formatCurrency(record.amount),
    record.paymentReference,
    formatReceiptStatusLabel(record.status),
    formatDisplayDate(record.issuedAt),
  ]);
}

function buildFilename(format: ExportFormat, filters: ReportExportFilters): string {
  const parts = ["receipts-report"];
  if (filters.year) parts.push(String(filters.year));
  if (filters.month) parts.push(String(filters.month).padStart(2, "0"));
  return `${parts.join("-")}.${format}`;
}

export async function exportReceiptsCsv(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllReceiptsForReport(filters);
  const csv = rowsToCsv(HEADERS, mapReceiptRows(records));

  return {
    content: csvToBuffer(csv),
    contentType: "text/csv; charset=utf-8",
    filename: buildFilename("csv", filters),
  };
}

export async function exportReceiptsExcel(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllReceiptsForReport(filters);

  return {
    content: rowsToExcelBuffer("Receipts", HEADERS, mapReceiptRows(records)),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildFilename("xlsx", filters),
  };
}

export async function exportReceipts(
  format: ExportFormat,
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  return format === "csv"
    ? exportReceiptsCsv(filters)
    : exportReceiptsExcel(filters);
}
