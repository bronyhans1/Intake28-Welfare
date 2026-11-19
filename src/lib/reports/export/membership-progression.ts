import { listAllMembershipProgressions } from "@/lib/progression/repository";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { csvToBuffer, rowsToCsv } from "@/lib/reports/export/csv";
import { rowsToExcelBuffer } from "@/lib/reports/export/excel";
import type { ExportFile, ExportFormat } from "@/lib/reports/types";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
} from "@/types/enums";
import type { SerializedMembershipProgression } from "@/types/membership-progression";

const HEADERS = [
  "Member",
  "Service Number",
  "Welfare Points",
  "Benefit Percentage",
  "Membership Status",
  "Maturity Status",
  "Consecutive Contributions",
  "Consecutive Missed Contributions",
  "Eligible To Claim",
  "Last Calculated At",
];

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

function statusLabel(status: string): string {
  return (
    MEMBERSHIP_PROGRESSION_STATUS_LABELS[
      status as MembershipProgressionStatus
    ] ?? status
  );
}

function mapRows(
  records: SerializedMembershipProgression[],
  names: Map<string, { fullName: string; serviceNumber: string }>,
) {
  return records
    .slice()
    .sort((a, b) => b.welfarePoints - a.welfarePoints)
    .map((record) => {
      const identity = names.get(record.memberId);
      return [
        identity?.fullName ?? "Unknown member",
        identity?.serviceNumber ?? "—",
        record.welfarePoints,
        record.benefitPercentage,
        statusLabel(record.membershipStatus),
        record.isMature ? "Mature" : "Not mature",
        record.consecutiveContributionMonths,
        record.consecutiveMissedMonths,
        record.eligibleToClaim ? "Yes" : "No",
        record.lastCalculatedAt,
      ];
    });
}

export async function exportMembershipProgressionCsv(): Promise<ExportFile> {
  const [records, names] = await Promise.all([
    listAllMembershipProgressions(),
    loadMemberNames(),
  ]);

  return {
    content: csvToBuffer(rowsToCsv(HEADERS, mapRows(records, names))),
    contentType: "text/csv; charset=utf-8",
    filename: "membership-progression-report.csv",
  };
}

export async function exportMembershipProgressionExcel(): Promise<ExportFile> {
  const [records, names] = await Promise.all([
    listAllMembershipProgressions(),
    loadMemberNames(),
  ]);

  return {
    content: rowsToExcelBuffer(
      "Progression",
      HEADERS,
      mapRows(records, names),
    ),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "membership-progression-report.xlsx",
  };
}

export async function exportMembershipProgression(
  format: ExportFormat,
): Promise<ExportFile> {
  return format === "csv"
    ? exportMembershipProgressionCsv()
    : exportMembershipProgressionExcel();
}

export async function listMembershipProgressionReportRows(options: {
  page: number;
  pageSize: number;
}): Promise<{
  rows: Array<{
    memberId: string;
    fullName: string;
    serviceNumber: string;
    welfarePoints: number;
    benefitPercentage: number;
    membershipStatus: string;
    isMature: boolean;
    consecutiveContributionMonths: number;
    consecutiveMissedMonths: number;
    eligibleToClaim: boolean;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const [records, names] = await Promise.all([
    listAllMembershipProgressions(),
    loadMemberNames(),
  ]);

  const sorted = records
    .slice()
    .sort((a, b) => b.welfarePoints - a.welfarePoints || a.memberId.localeCompare(b.memberId));

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const start = (page - 1) * options.pageSize;
  const slice = sorted.slice(start, start + options.pageSize);

  return {
    rows: slice.map((record) => {
      const identity = names.get(record.memberId);
      return {
        memberId: record.memberId,
        fullName: identity?.fullName ?? "Unknown member",
        serviceNumber: identity?.serviceNumber ?? "—",
        welfarePoints: record.welfarePoints,
        benefitPercentage: record.benefitPercentage,
        membershipStatus: record.membershipStatus,
        isMature: record.isMature,
        consecutiveContributionMonths: record.consecutiveContributionMonths,
        consecutiveMissedMonths: record.consecutiveMissedMonths,
        eligibleToClaim: record.eligibleToClaim,
      };
    }),
    total,
    page,
    pageSize: options.pageSize,
    totalPages,
  };
}
