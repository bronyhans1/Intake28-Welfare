import { COLLECTIONS } from "@/lib/constants";
import {
  formatMonthYearLabel,
  resolveTargetMonthYear,
  type MonthYear,
} from "@/lib/finance/period";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  formatOutstandingMonthsDisplay,
  resolveOutstandingBalance,
} from "@/lib/progression/outstanding-display";
import { listAllMembershipProgressions } from "@/lib/progression/repository";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import {
  MEMBERSHIP_PROGRESSION_STATUS_LABELS,
  MembershipProgressionStatus,
  UserStatus,
} from "@/types/enums";
import type { User } from "@/types/user";
import type { DefaulterListQuery } from "@/lib/validators/defaulters";

export interface DefaulterRecord {
  memberId: string;
  fullName: string;
  serviceNumber: string;
  /** Count of unpaid contribution months (Progression Engine). */
  outstandingMonths: number;
  outstandingMonthLabels: string[];
  outstandingMonthsDisplay: string;
  outstandingAmount: number;
  membershipStatus: string;
  membershipStatusLabel: string;
  lastContributionDate: string | null;
}

export interface DefaulterListResult {
  records: DefaulterRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DefaulterFilters {
  month?: number;
  year?: number;
}

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

async function fetchActiveMemberIds(): Promise<Set<string>> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.USERS).get();

  return new Set(
    snapshot.docs
      .map((doc) =>
        mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>),
      )
      .filter((user) => user.status === UserStatus.ACTIVE)
      .map((user) => user.id),
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

function matchesDefaulterSearch(
  member: Pick<DefaulterRecord, "fullName" | "serviceNumber">,
  search: string,
): boolean {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  return (
    member.fullName.toLowerCase().includes(normalized) ||
    member.serviceNumber.toLowerCase().includes(normalized)
  );
}

function includesPeriod(
  months: Array<{ month: number; year: number }>,
  period: MonthYear,
): boolean {
  return months.some(
    (item) => item.month === period.month && item.year === period.year,
  );
}

/**
 * Defaulters / outstanding list from the Membership Progression Engine.
 * Does not recalculate formulas — reads persisted outstandingMonths.
 */
export async function getDefaulters(
  filters: DefaulterFilters = {},
): Promise<DefaulterRecord[]> {
  const hasPeriodFilter =
    typeof filters.month === "number" && typeof filters.year === "number";
  const periodFilter = hasPeriodFilter
    ? resolveTargetMonthYear(filters)
    : null;

  const [progressions, names, monthlyDuesAmount, activeMemberIds] =
    await Promise.all([
      listAllMembershipProgressions(),
      loadMemberNames(),
      getMonthlyDuesAmount(),
      fetchActiveMemberIds(),
    ]);

  const records: DefaulterRecord[] = [];

  for (const row of progressions) {
    if (!activeMemberIds.has(row.memberId)) continue;

    const months = row.outstandingMonths ?? [];
    const count = row.outstandingContributionMonths ?? months.length;
    if (count <= 0) continue;
    if (periodFilter && !includesPeriod(months, periodFilter)) continue;

    const labels = months.map((period) => formatMonthYearLabel(period));
    const identity = names.get(row.memberId);

    records.push({
      memberId: row.memberId,
      fullName: identity?.fullName ?? "Unknown member",
      serviceNumber: identity?.serviceNumber ?? "—",
      outstandingMonths: count,
      outstandingMonthLabels: labels,
      outstandingMonthsDisplay: formatOutstandingMonthsDisplay(labels),
      outstandingAmount: resolveOutstandingBalance(count, monthlyDuesAmount),
      membershipStatus: row.membershipStatus,
      membershipStatusLabel:
        MEMBERSHIP_PROGRESSION_STATUS_LABELS[
          row.membershipStatus as MembershipProgressionStatus
        ] ?? row.membershipStatus,
      lastContributionDate: row.lastSuccessfulContributionDate,
    });
  }

  return records.sort(
    (left, right) =>
      right.outstandingMonths - left.outstandingMonths ||
      left.fullName.localeCompare(right.fullName),
  );
}

export async function listDefaulters(
  query: DefaulterListQuery,
): Promise<DefaulterListResult> {
  const allDefaulters = await getDefaulters({
    month: query.month,
    year: query.year,
  });

  const filtered = query.search
    ? allDefaulters.filter((record) =>
        matchesDefaulterSearch(record, query.search ?? ""),
      )
    : allDefaulters;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    records: filtered.slice(start, start + query.pageSize),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}
