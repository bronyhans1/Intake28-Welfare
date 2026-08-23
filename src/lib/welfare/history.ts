import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { resolveWelfareSupportTypeDisplayName } from "@/lib/welfare-support-types/labels";
import { listAllWelfareSupportTypeOptions } from "@/lib/welfare-support-types/repository";
import { fetchFilteredWelfareSupport } from "@/lib/welfare/repository";
import type { WelfareSupportStats } from "@/lib/welfare/repository";
import { requireOwnMemberId } from "@/lib/members/member-context";
import type { WelfareHistoryListQuery } from "@/lib/validators/welfare-support";
import {
  PaymentStatus,
  PaymentType,
  WelfareSupportStatus,
} from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { Payment, SerializedPayment } from "@/types/payment";
import type {
  WelfareHistoryEntry,
  WelfareHistoryListResult,
  WelfareHistorySource,
} from "@/types/welfare-history";
import type { SerializedWelfareSupport } from "@/types/welfare-support";

function mapPayment(id: string, data: Record<string, unknown>): Payment {
  return { id, ...data } as Payment;
}

function serializePayment(record: Payment): SerializedPayment {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedPayment>(
    id,
    rest as Record<string, unknown>,
  );
}

async function fetchSuccessfulClaimDisbursements(
  memberId?: string,
): Promise<SerializedPayment[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.PAYMENTS).get();

  return snapshot.docs
    .map((doc) =>
      serializePayment(mapPayment(doc.id, doc.data() as Record<string, unknown>)),
    )
    .filter(
      (payment) =>
        payment.paymentType === PaymentType.CLAIM_PAYMENT &&
        payment.status === PaymentStatus.SUCCESS &&
        (!memberId || payment.memberId === memberId),
    );
}

function welfareSupportToEntry(
  record: SerializedWelfareSupport,
  labelMap: Record<string, string>,
): WelfareHistoryEntry {
  const statusLabel =
    record.status === WelfareSupportStatus.APPROVED
      ? "Approved"
      : record.status === WelfareSupportStatus.PAID
        ? "Paid"
        : record.status === WelfareSupportStatus.PENDING
          ? "Pending"
          : record.status === WelfareSupportStatus.CANCELLED
            ? "Cancelled"
            : record.status;

  return {
    id: `ws:${record.id}`,
    source: "welfare_support",
    memberId: record.memberId,
    memberName: record.memberName,
    serviceNumber: record.serviceNumber,
    benefitTypeLabel: resolveWelfareSupportTypeDisplayName(
      record.supportType,
      labelMap,
    ),
    amount: record.amount,
    statusLabel,
    recordedByName: record.recordedByName,
    occurredAt: record.createdAt,
    welfareSupportId: record.id,
    supportTypeCode: record.supportType,
    benefitTypeCode: record.supportType,
    welfareSupportStatus: record.status,
    description: record.description,
  };
}

function claimPaymentToEntry(payment: SerializedPayment): WelfareHistoryEntry {
  return {
    id: `cp:${payment.id}`,
    source: "claim_payment",
    memberId: payment.memberId,
    memberName: payment.memberName,
    serviceNumber: payment.serviceNumber,
    benefitTypeLabel:
      payment.claimTypeDisplayName?.trim() ||
      payment.claimTypeCode?.trim() ||
      "Claim Payment",
    amount: payment.amount,
    statusLabel: "Paid",
    recordedByName: payment.paidByName?.trim() || "—",
    occurredAt: payment.paidAt ?? payment.createdAt,
    claimId: payment.claimId ?? null,
    claimNumber: payment.claimNumber ?? null,
    paymentId: payment.id,
    reference: payment.reference,
    benefitTypeCode: payment.claimTypeCode?.trim() || undefined,
    description: payment.claimNumber
      ? `Claim ${payment.claimNumber}`
      : null,
  };
}

function matchesSearch(entry: WelfareHistoryEntry, search: string): boolean {
  const q = search.toLowerCase();
  return (
    entry.memberName.toLowerCase().includes(q) ||
    entry.serviceNumber.toLowerCase().includes(q) ||
    entry.benefitTypeLabel.toLowerCase().includes(q) ||
    (entry.claimNumber ?? "").toLowerCase().includes(q) ||
    (entry.description ?? "").toLowerCase().includes(q) ||
    (entry.reference ?? "").toLowerCase().includes(q)
  );
}

function matchesStatusFilter(
  entry: WelfareHistoryEntry,
  status: WelfareHistoryListQuery["status"],
): boolean {
  if (!status) return true;
  if (entry.source === "claim_payment") {
    return status === WelfareSupportStatus.PAID;
  }
  return entry.welfareSupportStatus === status;
}

function matchesPeriodFilter(
  occurredAt: string,
  month?: number,
  year?: number,
): boolean {
  if (!month && !year) return true;
  const date = new Date(occurredAt);
  if (year && date.getFullYear() !== year) return false;
  if (month && date.getMonth() + 1 !== month) return false;
  return true;
}

function matchesBenefitTypeFilter(
  entry: WelfareHistoryEntry,
  supportType?: string,
): boolean {
  if (!supportType) return true;
  return entry.benefitTypeCode === supportType;
}

function paginateEntries(
  entries: WelfareHistoryEntry[],
  page: number,
  pageSize: number,
): WelfareHistoryListResult {
  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    entries: entries.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * Build the full unified welfare history list (unpaginated).
 */
async function fetchUnifiedWelfareHistoryEntries(
  query: Omit<WelfareHistoryListQuery, "page" | "pageSize">,
): Promise<WelfareHistoryEntry[]> {
  const sourceFilter: WelfareHistorySource | "all" = query.source ?? "all";
  const labelOptions = await listAllWelfareSupportTypeOptions();
  const labelMap = Object.fromEntries(
    labelOptions.map((type) => [type.code, type.displayName]),
  );

  const welfareFilter = {
    search: query.search,
    supportType: query.supportType,
    status: sourceFilter === "claim_payment" ? undefined : query.status,
    memberId: query.memberId,
    supportYear: query.supportYear,
    supportMonth: query.supportMonth,
  };

  let welfareRows: SerializedWelfareSupport[] = [];
  if (sourceFilter === "all" || sourceFilter === "welfare_support") {
    welfareRows = await fetchFilteredWelfareSupport(welfareFilter);
  }

  let claimPayments: SerializedPayment[] = [];
  if (sourceFilter === "all" || sourceFilter === "claim_payment") {
    claimPayments = await fetchSuccessfulClaimDisbursements(query.memberId);
  }

  const seenClaimIds = new Set<string>();
  const entries: WelfareHistoryEntry[] = [];

  for (const payment of claimPayments) {
    if (payment.claimId) {
      if (seenClaimIds.has(payment.claimId)) continue;
      seenClaimIds.add(payment.claimId);
    }
    const entry = claimPaymentToEntry(payment);
    if (query.search && !matchesSearch(entry, query.search)) continue;
    if (!matchesStatusFilter(entry, query.status)) continue;
    if (
      !matchesPeriodFilter(
        entry.occurredAt,
        query.supportMonth,
        query.supportYear,
      )
    ) {
      continue;
    }
    if (!matchesBenefitTypeFilter(entry, query.supportType)) continue;
    entries.push(entry);
  }

  for (const record of welfareRows) {
    const entry = welfareSupportToEntry(record, labelMap);
    if (query.search && !matchesSearch(entry, query.search)) continue;
    if (!matchesStatusFilter(entry, query.status)) continue;
    if (!matchesBenefitTypeFilter(entry, query.supportType)) continue;
    entries.push(entry);
  }

  entries.sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );

  return entries;
}

/** Unified welfare paid totals for finance/reporting (read-only). */
export async function getUnifiedWelfarePaidStats(filters: {
  memberId?: string;
  month?: number;
  year?: number;
} = {}): Promise<WelfareSupportStats> {
  const entries = await fetchUnifiedWelfareHistoryEntries({
    memberId: filters.memberId,
    supportMonth: filters.month,
    supportYear: filters.year,
    source: "all",
  });

  const memberIds = new Set(entries.map((entry) => entry.memberId));

  return {
    totalRecords: entries.length,
    totalAmount: entries.reduce((sum, entry) => sum + entry.amount, 0),
    membersAssisted: memberIds.size,
  };
}

/**
 * Unified welfare assistance / claim benefit history for admin/treasurer.
 * Reads welfare_support + successful CLAIM_PAYMENT ledger rows (no writes).
 */
export async function listWelfareHistory(
  query: WelfareHistoryListQuery,
): Promise<WelfareHistoryListResult> {
  const entries = await fetchUnifiedWelfareHistoryEntries(query);
  return paginateEntries(entries, query.page, query.pageSize);
}

/** Query options for member-scoped welfare history (memberId enforced server-side). */
export type MemberWelfareHistoryQuery = Omit<
  Partial<WelfareHistoryListQuery>,
  "memberId"
>;

/**
 * Member-scoped unified history. Enforces ownership server-side.
 * Works for members and linked executive accounts (admin/treasurer).
 */
export async function listMemberWelfareHistory(
  actor: CurrentUser,
  query: MemberWelfareHistoryQuery = {},
): Promise<WelfareHistoryListResult> {
  const memberId = await requireOwnMemberId(actor);

  return listWelfareHistory({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 100,
    source: query.source ?? "all",
    search: query.search,
    supportType: query.supportType,
    status: query.status,
    supportYear: query.supportYear,
    supportMonth: query.supportMonth,
    memberId,
  });
}
