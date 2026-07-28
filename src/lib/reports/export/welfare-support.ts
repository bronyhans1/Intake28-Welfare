import { fetchAllWelfareSupportForReport } from "@/lib/reports/data";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat, ReportExportFilters } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { WELFARE_SUPPORT_TYPE_LABELS, WelfareSupportType } from "@/types/enums";
import type { SerializedWelfareSupport } from "@/types/welfare-support";

const HEADERS = [
  "Support Type",
  "Member",
  "Service Number",
  "Amount",
  "Date Recorded",
];

function formatSupportTypeLabel(value: SerializedWelfareSupport["supportType"]): string {
  return WELFARE_SUPPORT_TYPE_LABELS[value as WelfareSupportType] ?? value;
}

function mapWelfareSupportRows(records: SerializedWelfareSupport[]) {
  return records.map((record) => [
    formatSupportTypeLabel(record.supportType),
    record.memberName,
    record.serviceNumber,
    formatCurrency(record.amount),
    formatDisplayDate(record.createdAt),
  ]);
}

function buildFilename(format: ExportFormat, filters: ReportExportFilters): string {
  const parts = ["welfare-support-report"];
  if (filters.year) parts.push(String(filters.year));
  if (filters.month) parts.push(String(filters.month).padStart(2, "0"));
  return `${parts.join("-")}.${format}`;
}

export async function exportWelfareSupportCsv(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllWelfareSupportForReport({
    supportMonth: filters.month,
    supportYear: filters.year,
    memberId: filters.memberId,
    supportType: filters.supportType as never,
  });

  const csv = rowsToCsv(HEADERS, mapWelfareSupportRows(records));

  return {
    content: csvToBuffer(csv),
    contentType: "text/csv; charset=utf-8",
    filename: buildFilename("csv", filters),
  };
}

export async function exportWelfareSupportExcel(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const records = await fetchAllWelfareSupportForReport({
    supportMonth: filters.month,
    supportYear: filters.year,
    memberId: filters.memberId,
    supportType: filters.supportType as never,
  });

  return {
    content: rowsToExcelBuffer(
      "Welfare Support",
      HEADERS,
      mapWelfareSupportRows(records),
    ),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildFilename("xlsx", filters),
  };
}

export async function exportWelfareSupport(
  format: ExportFormat,
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  return format === "csv"
    ? exportWelfareSupportCsv(filters)
    : exportWelfareSupportExcel(filters);
}
