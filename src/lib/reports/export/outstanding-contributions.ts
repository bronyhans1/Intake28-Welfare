import { COLLECTIONS } from "@/lib/constants";
import { formatMonthYearLabel } from "@/lib/finance/period";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatOutstandingMonthsDisplay } from "@/lib/progression/outstanding-display";
import { listAllMembershipProgressions } from "@/lib/progression/repository";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat } from "@/lib/reports/types";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
} from "@/types/enums";
import type { OutstandingContributionMonth } from "@/types/membership-progression";

const HEADERS = [
  "Member",
  "Service Number",
  "Outstanding Months",
  "Total Outstanding Months",
  "Outstanding Amount",
  "Current Status",
];

export interface OutstandingContributionsReportRow {
  memberId: string;
  fullName: string;
  serviceNumber: string;
  outstandingMonths: OutstandingContributionMonth[];
  outstandingMonthLabels: string[];
  outstandingMonthsDisplay: string;
  totalOutstandingMonths: number;
  outstandingAmount: number;
  membershipStatus: string;
  membershipStatusLabel: string;
}

export interface OutstandingContributionsReportResult {
  rows: OutstandingContributionsReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function statusLabel(status: string): string {
  return (
    MEMBERSHIP_PROGRESSION_STATUS_LABELS[
      status as MembershipProgressionStatus
    ] ?? status
  );
}

async function loadMemberNames(): Promise<
  Map<string, { fullName: string; serviceNumber: string }>
> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.USERS).get();
  const map = new Map<string, { fullName: string; serviceNumber: string }>();
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    map.set(doc.id, {
      fullName: String(data.fullName ?? "Unknown member"),
      serviceNumber: String(data.serviceNumber ?? "—"),
    });
  }
  return map;
}

function matchesSearch(
  row: Pick<OutstandingContributionsReportRow, "fullName" | "serviceNumber">,
  search: string,
): boolean {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.fullName.toLowerCase().includes(normalized) ||
    row.serviceNumber.toLowerCase().includes(normalized)
  );
}

export async function buildOutstandingContributionsReportRows(filters: {
  search?: string;
  status?: string;
  memberId?: string;
} = {}): Promise<OutstandingContributionsReportRow[]> {
  const [records, names, monthlyDuesAmount] = await Promise.all([
    listAllMembershipProgressions(),
    loadMemberNames(),
    getMonthlyDuesAmount(),
  ]);

  return records
    .map((record) => {
      const identity = names.get(record.memberId);
      const outstandingMonths = record.outstandingMonths ?? [];
      const totalOutstandingMonths =
        record.outstandingContributionMonths ?? outstandingMonths.length;
      return {
        memberId: record.memberId,
        fullName: identity?.fullName ?? "Unknown member",
        serviceNumber: identity?.serviceNumber ?? "—",
        outstandingMonths,
        outstandingMonthLabels: outstandingMonths.map((period) =>
          formatMonthYearLabel(period),
        ),
        outstandingMonthsDisplay: formatOutstandingMonthsDisplay(
          outstandingMonths.map((period) => formatMonthYearLabel(period)),
        ),
        totalOutstandingMonths,
        outstandingAmount: Number(
          (totalOutstandingMonths * monthlyDuesAmount).toFixed(2),
        ),
        membershipStatus: record.membershipStatus,
        membershipStatusLabel: statusLabel(record.membershipStatus),
      };
    })
    .filter((row) => row.totalOutstandingMonths > 0)
    .filter((row) => {
      if (filters.memberId && row.memberId !== filters.memberId) return false;
      if (
        filters.status &&
        filters.status !== "all" &&
        row.membershipStatus !== filters.status
      ) {
        return false;
      }
      return matchesSearch(row, filters.search ?? "");
    })
    .sort(
      (a, b) =>
        b.totalOutstandingMonths - a.totalOutstandingMonths ||
        a.fullName.localeCompare(b.fullName),
    );
}

function mapExportRows(rows: OutstandingContributionsReportRow[]) {
  return rows.map((row) => [
    row.fullName,
    row.serviceNumber,
    row.outstandingMonthsDisplay,
    row.totalOutstandingMonths,
    row.outstandingAmount,
    row.membershipStatusLabel,
  ]);
}

export async function exportOutstandingContributionsCsv(
  filters: {
    search?: string;
    status?: string;
    memberId?: string;
  } = {},
): Promise<ExportFile> {
  const rows = await buildOutstandingContributionsReportRows(filters);
  return {
    content: csvToBuffer(rowsToCsv(HEADERS, mapExportRows(rows))),
    contentType: "text/csv; charset=utf-8",
    filename: "outstanding-contributions-report.csv",
  };
}

export async function exportOutstandingContributionsExcel(
  filters: {
    search?: string;
    status?: string;
    memberId?: string;
  } = {},
): Promise<ExportFile> {
  const rows = await buildOutstandingContributionsReportRows(filters);
  return {
    content: rowsToExcelBuffer(
      "Outstanding",
      HEADERS,
      mapExportRows(rows),
    ),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "outstanding-contributions-report.xlsx",
  };
}

export async function exportOutstandingContributions(
  format: ExportFormat,
  filters: {
    search?: string;
    status?: string;
    memberId?: string;
  } = {},
): Promise<ExportFile> {
  return format === "csv"
    ? exportOutstandingContributionsCsv(filters)
    : exportOutstandingContributionsExcel(filters);
}

export async function listOutstandingContributionsReportRows(options: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  memberId?: string;
}): Promise<OutstandingContributionsReportResult> {
  const allRows = await buildOutstandingContributionsReportRows({
    search: options.search,
    status: options.status,
    memberId: options.memberId,
  });

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const start = (page - 1) * options.pageSize;

  return {
    rows: allRows.slice(start, start + options.pageSize),
    total,
    page,
    pageSize: options.pageSize,
    totalPages,
  };
}
