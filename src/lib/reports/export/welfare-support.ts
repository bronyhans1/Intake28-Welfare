import { fetchAllWelfareHistoryForReport } from "@/lib/reports/data";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat, ReportExportFilters } from "@/lib/reports/types";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { resolveWelfareSupportTypeDisplayName } from "@/lib/welfare-support-types/labels";
import { listAllWelfareSupportTypeOptions } from "@/lib/welfare-support-types/repository";
import type { WelfareHistoryEntry } from "@/types/welfare-history";

const HEADERS = [
  "Support Type / Benefit",
  "Source",
  "Member",
  "Service Number",
  "Amount",
  "Date",
];

function sourceLabel(source: WelfareHistoryEntry["source"]): string {
  return source === "claim_payment" ? "Claim Payment" : "Welfare Support";
}

function benefitLabel(
  entry: WelfareHistoryEntry,
  labelMap: Record<string, string>,
): string {
  if (entry.source === "welfare_support" && entry.supportTypeCode) {
    return resolveWelfareSupportTypeDisplayName(entry.supportTypeCode, labelMap);
  }
  return entry.benefitTypeLabel;
}

function mapWelfareHistoryRows(
  entries: WelfareHistoryEntry[],
  labelMap: Record<string, string>,
) {
  return entries.map((entry) => [
    benefitLabel(entry, labelMap),
    sourceLabel(entry.source),
    entry.memberName,
    entry.serviceNumber,
    formatCurrency(entry.amount),
    formatDisplayDate(entry.occurredAt),
  ]);
}

function buildFilename(format: ExportFormat, filters: ReportExportFilters): string {
  const parts = ["welfare-support-report"];
  if (filters.year) parts.push(String(filters.year));
  if (filters.month) parts.push(String(filters.month).padStart(2, "0"));
  return `${parts.join("-")}.${format}`;
}

async function loadLabelMap(): Promise<Record<string, string>> {
  const types = await listAllWelfareSupportTypeOptions();
  return Object.fromEntries(types.map((type) => [type.code, type.displayName]));
}

export async function exportWelfareSupportCsv(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const [entries, labelMap] = await Promise.all([
    fetchAllWelfareHistoryForReport({
      supportMonth: filters.month,
      supportYear: filters.year,
      memberId: filters.memberId,
      supportType: filters.supportType as never,
    }),
    loadLabelMap(),
  ]);

  const csv = rowsToCsv(HEADERS, mapWelfareHistoryRows(entries, labelMap));

  return {
    content: csvToBuffer(csv),
    contentType: "text/csv; charset=utf-8",
    filename: buildFilename("csv", filters),
  };
}

export async function exportWelfareSupportExcel(
  filters: ReportExportFilters = {},
): Promise<ExportFile> {
  const [entries, labelMap] = await Promise.all([
    fetchAllWelfareHistoryForReport({
      supportMonth: filters.month,
      supportYear: filters.year,
      memberId: filters.memberId,
      supportType: filters.supportType as never,
    }),
    loadLabelMap(),
  ]);

  return {
    content: rowsToExcelBuffer(
      "Welfare Support",
      HEADERS,
      mapWelfareHistoryRows(entries, labelMap),
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
