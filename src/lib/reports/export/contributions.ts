import { formatContributionSourceLabel, formatContributionTypeLabel } from "@/lib/contributions/labels";
import { fetchAllContributionsForReport } from "@/lib/reports/data";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat, ReportExportFilters } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedContribution } from "@/types/contribution";

const HEADERS = [
  "Contribution Type",
  "Member",
  "Service Number",
  "Amount",
  "Month",
  "Year",
  "Source",
  "Payment Reference",
  "Date Recorded",
];

function mapContributionRows(records: SerializedContribution[]) {
  return records.map((record) => [
    formatContributionTypeLabel(record.contributionType),
    record.memberName,
    record.serviceNumber,
    formatCurrency(record.amount),
    record.month,
    record.year,
    formatContributionSourceLabel(record.source),
    record.paymentReference ?? "",
    formatDisplayDate(record.createdAt),
  ]);
}

function buildFilename(format: ExportFormat, filters: ReportExportFilters): string {
  const parts = ["contributions-report"];
  if (filters.year) parts.push(String(filters.year));
  if (filters.month) parts.push(String(filters.month).padStart(2, "0"));
  return `${parts.join("-")}.${format}`;
}

export async function exportContributionsCsv(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllContributionsForReport({
    month: filters.month,
    year: filters.year,
    memberId: filters.memberId,
    contributionType: filters.contributionType as never,
  });

  const csv = rowsToCsv(HEADERS, mapContributionRows(records));

  return {
    content: csvToBuffer(csv),
    contentType: "text/csv; charset=utf-8",
    filename: buildFilename("csv", filters),
  };
}

export async function exportContributionsExcel(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllContributionsForReport({
    month: filters.month,
    year: filters.year,
    memberId: filters.memberId,
    contributionType: filters.contributionType as never,
  });

  return {
    content: rowsToExcelBuffer("Contributions", HEADERS, mapContributionRows(records)),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildFilename("xlsx", filters),
  };
}

export async function exportContributions(
  format: ExportFormat,
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  return format === "csv"
    ? exportContributionsCsv(filters)
    : exportContributionsExcel(filters);
}
