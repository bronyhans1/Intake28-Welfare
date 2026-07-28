import { fetchDefaultersForReport } from "@/lib/reports/data";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat, ReportExportFilters } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils/currency";
import type { DefaulterRecord } from "@/lib/finance/defaulters";

const HEADERS = [
  "Member",
  "Service Number",
  "Outstanding Months",
  "Months Owing",
  "Outstanding Balance",
  "Status",
];

function mapDefaulterRows(records: DefaulterRecord[]) {
  return records.map((record) => [
    record.fullName,
    record.serviceNumber,
    record.outstandingMonthsDisplay,
    record.outstandingMonths,
    formatCurrency(record.outstandingAmount),
    record.membershipStatusLabel,
  ]);
}

function buildFilename(format: ExportFormat, filters: ReportExportFilters): string {
  const parts = ["defaulters-report"];
  if (filters.year) parts.push(String(filters.year));
  if (filters.month) parts.push(String(filters.month).padStart(2, "0"));
  return `${parts.join("-")}.${format}`;
}

export async function exportDefaultersCsv(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchDefaultersForReport({
    month: filters.month,
    year: filters.year,
  });

  const csv = rowsToCsv(HEADERS, mapDefaulterRows(records));

  return {
    content: csvToBuffer(csv),
    contentType: "text/csv; charset=utf-8",
    filename: buildFilename("csv", filters),
  };
}

export async function exportDefaultersExcel(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchDefaultersForReport({
    month: filters.month,
    year: filters.year,
  });

  return {
    content: rowsToExcelBuffer("Defaulters", HEADERS, mapDefaulterRows(records)),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildFilename("xlsx", filters),
  };
}

export async function exportDefaulters(
  format: ExportFormat,
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  return format === "csv"
    ? exportDefaultersCsv(filters)
    : exportDefaultersExcel(filters);
}
