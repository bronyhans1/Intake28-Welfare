import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { ContributionAuditAction } from "@/lib/contributions/audit";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import { getMemberById } from "@/lib/members/repository";
import { ContributionStatus, ContributionType, ContributionSource } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { Contribution, SerializedContribution } from "@/types/contribution";
import type {
  ContributionListQuery,
  CreateContributionInput,
  UpdateContributionInput,
} from "@/lib/validators/contributions";
import { hasPermission, Permission } from "@/lib/auth/permissions";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): Contribution {
  return { id, ...data } as Contribution;
}

function serializeRecord(record: Contribution): SerializedContribution {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedContribution>(id, rest as Record<string, unknown>);
}

function deriveReportingFields(input: { month: number; year: number }) {
  return { contributionMonth: input.month, contributionYear: input.year };
}

export interface ContributionListResult {
  records: SerializedContribution[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContributionStats {
  totalContributions: number;
  totalAmountCollected: number;
  membersContributed: number;
}

async function fetchAllRecords(): Promise<Contribution[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.CONTRIBUTIONS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function getContributionById(
  recordId: string,
): Promise<SerializedContribution | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(recordId).get();

  if (!doc.exists) {
    return null;
  }

  return serializeRecord(
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function getContributionByPaymentReference(
  paymentReference: string,
): Promise<SerializedContribution | null> {
  const records = await fetchAllRecords();
  const record = records.find((item) => item.paymentReference === paymentReference);
  return record ? serializeRecord(record) : null;
}

export async function listContributionsByPaymentReference(
  paymentReference: string,
): Promise<SerializedContribution[]> {
  const records = await fetchAllRecords();
  return records
    .filter((item) => item.paymentReference === paymentReference)
    .map(serializeRecord);
}

export async function findPaidMonthlyDuesContribution(
  memberId: string,
  month: number,
  year: number,
): Promise<SerializedContribution | null> {
  const records = await fetchAllRecords();
  const record = records.find(
    (item) =>
      item.memberId === memberId &&
      item.contributionType === ContributionType.MONTHLY_DUES &&
      item.status === ContributionStatus.PAID &&
      item.month === month &&
      item.year === year,
  );

  return record ? serializeRecord(record) : null;
}

export interface AutomatedContributionInput {
  memberId: string;
  memberName: string;
  serviceNumber: string;
  contributionType: ContributionType;
  amount: number;
  month: number;
  year: number;
  source: ContributionSource;
  paymentReference: string;
  paymentId: string;
  remarks?: string | null;
}

export async function createAutomatedContribution(
  input: AutomatedContributionInput,
): Promise<SerializedContribution> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.CONTRIBUTIONS).doc();
  const reporting = deriveReportingFields(input);

  const document = sanitizeFirestoreData({
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    contributionType: input.contributionType,
    amount: input.amount,
    month: input.month,
    year: input.year,
    status: ContributionStatus.PAID,
    remarks:
      input.remarks?.trim() ||
      `Created from Paystack payment ${input.paymentReference}`,
    recordedBy: "paystack-automation",
    recordedByName: "Paystack Automation",
    contributionMonth: reporting.contributionMonth,
    contributionYear: reporting.contributionYear,
    source: input.source,
    paymentReference: input.paymentReference,
    paymentId: input.paymentId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createAutomatedContribution", document);
  await ref.set(document);

  const created = await getContributionById(ref.id);
  if (!created) {
    throw new Error("Failed to create contribution from payment.");
  }

  const { recalculateMembershipProgression } = await import(
    "@/lib/progression"
  );
  await recalculateMembershipProgression(input.memberId);

  return created;
}

export async function listContributions(
  query: ContributionListQuery,
): Promise<ContributionListResult> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (query.contributionType && record.contributionType !== query.contributionType) {
      return false;
    }
    if (query.status && record.status !== query.status) return false;
    if (query.memberId && record.memberId !== query.memberId) return false;
    if (query.year && record.year !== query.year) return false;
    if (query.month && record.month !== query.month) return false;
    if (query.search) {
      const search = query.search.toLowerCase();
      const matchesMember = record.memberName.toLowerCase().includes(search);
      const matchesService = record.serviceNumber.toLowerCase().includes(search);
      const matchesRecorder = record.recordedByName.toLowerCase().includes(search);
      if (!matchesMember && !matchesService && !matchesRecorder) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const records_ = filtered.slice(start, start + query.pageSize).map(serializeRecord);

  return { records: records_, total, page, pageSize: query.pageSize, totalPages };
}

export async function createContribution(
  input: CreateContributionInput,
  actor: CurrentUser,
): Promise<{ recordId: string; monthlyDuesAmount: number }> {
  const member = await getMemberById(input.memberId);
  if (!member) {
    throw new Error("Selected member does not exist.");
  }

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.CONTRIBUTIONS).doc();

  const monthlyDuesAmount = await getMonthlyDuesAmount();
  const reporting = deriveReportingFields(input);

  const document = sanitizeFirestoreData({
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    contributionType: input.contributionType,
    amount: input.amount,
    month: input.month,
    year: input.year,
    status: ContributionStatus.PAID,
    remarks: input.remarks?.trim() || null,
    recordedBy: actor.uid,
    recordedByName: actor.fullName,
    contributionMonth: reporting.contributionMonth,
    contributionYear: reporting.contributionYear,
    source: ContributionSource.MANUAL,
    paymentReference: null,
    paymentId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createContribution", document);
  await ref.set(document);

  await createAuditLog({
    action: ContributionAuditAction.CONTRIBUTION_CREATED,
    entityType: "contribution",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: {
      memberId: input.memberId,
      memberName: input.memberName,
      serviceNumber: input.serviceNumber,
      contributionType: input.contributionType,
      amount: input.amount,
      month: input.month,
      year: input.year,
    },
  });

  const { recalculateMembershipProgression } = await import(
    "@/lib/progression"
  );
  await recalculateMembershipProgression(input.memberId);

  return { recordId: ref.id, monthlyDuesAmount };
}

export async function updateContribution(
  recordId: string,
  input: UpdateContributionInput,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(recordId).get();

  if (!doc.exists) {
    throw new Error("Contribution record not found.");
  }

  const existing = mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);

  const updatePayload = sanitizeFirestoreData({
    contributionType: input.contributionType,
    amount: input.amount,
    remarks: input.remarks?.trim() || null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateContribution", updatePayload);
  await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(recordId).update(updatePayload);

  await createAuditLog({
    action: ContributionAuditAction.CONTRIBUTION_UPDATED,
    entityType: "contribution",
    entityId: recordId,
    ...buildAuditActor(actor),
    changes: {
      contributionType: {
        before: existing.contributionType,
        after: input.contributionType,
      },
      amount: { before: existing.amount, after: input.amount },
      remarks: { before: existing.remarks ?? null, after: input.remarks ?? null },
    },
    metadata: {
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
      contributionType: input.contributionType,
      amount: input.amount,
    },
  });

  const { recalculateMembershipProgression } = await import(
    "@/lib/progression"
  );
  await recalculateMembershipProgression(existing.memberId);
}

/**
 * Reverses a contribution by marking it cancelled (no longer counts toward progression).
 */
export async function reverseContribution(
  recordId: string,
  actor: CurrentUser,
  reason?: string | null,
): Promise<void> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(recordId).get();

  if (!doc.exists) {
    throw new Error("Contribution record not found.");
  }

  const existing = mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);

  if (existing.status === ContributionStatus.CANCELLED) {
    return;
  }

  const remarks = reason?.trim()
    ? `${existing.remarks ? `${existing.remarks} | ` : ""}Reversed: ${reason.trim()}`
    : existing.remarks ?? null;

  const updatePayload = sanitizeFirestoreData({
    status: ContributionStatus.CANCELLED,
    remarks,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("reverseContribution", updatePayload);
  await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(recordId).update(updatePayload);

  await createAuditLog({
    action: ContributionAuditAction.CONTRIBUTION_UPDATED,
    entityType: "contribution",
    entityId: recordId,
    ...buildAuditActor(actor),
    changes: {
      status: { before: existing.status, after: ContributionStatus.CANCELLED },
    },
    metadata: {
      memberName: existing.memberName,
      serviceNumber: existing.serviceNumber,
      reversed: true,
      reason: reason?.trim() || null,
    },
  });

  const { recalculateMembershipProgression } = await import(
    "@/lib/progression"
  );
  await recalculateMembershipProgression(existing.memberId);
}

export interface MonthlyDuesCollectedStats {
  collectedAmount: number;
  paidMemberIds: string[];
}

export async function getMonthlyDuesCollectedStats(
  filters: { memberId?: string; month?: number; year?: number } = {},
): Promise<MonthlyDuesCollectedStats> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (record.contributionType !== ContributionType.MONTHLY_DUES) return false;
    if (record.status !== ContributionStatus.PAID) return false;
    if (filters.memberId && record.memberId !== filters.memberId) return false;
    if (filters.year && record.year !== filters.year) return false;
    if (filters.month && record.month !== filters.month) return false;
    return true;
  });

  return {
    collectedAmount: filtered.reduce((sum, record) => sum + record.amount, 0),
    paidMemberIds: [...new Set(filtered.map((record) => record.memberId))],
  };
}

export async function getLastMonthlyDuesContributionDates(): Promise<
  Record<string, string>
> {
  const records = await fetchAllRecords();
  const dates: Record<string, string> = {};

  for (const record of records) {
    if (record.contributionType !== ContributionType.MONTHLY_DUES) continue;
    if (record.status !== ContributionStatus.PAID) continue;

    const serialized = serializeRecord(record);
    const existing = dates[record.memberId];

    if (!existing || serialized.createdAt > existing) {
      dates[record.memberId] = serialized.createdAt;
    }
  }

  return dates;
}

export async function getContributionStats(
  filters: { memberId?: string; month?: number; year?: number } = {},
): Promise<ContributionStats> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (filters.memberId && record.memberId !== filters.memberId) return false;
    if (filters.year && record.year !== filters.year) return false;
    if (filters.month && record.month !== filters.month) return false;
    return record.status === ContributionStatus.PAID;
  });

  const memberIds = new Set(filtered.map((r) => r.memberId));

  return {
    totalContributions: filtered.length,
    totalAmountCollected: filtered.reduce((sum, r) => sum + r.amount, 0),
    membersContributed: memberIds.size,
  };
}

export function getContributionMonths(
  start: { year: number; month: number },
  end: { year: number; month: number },
): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  let y = start.year;
  let m = start.month;

  while (y < end.year || (y === end.year && m <= end.month)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return months;
}

export function canViewContributions(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_CONTRIBUTIONS);
}

export function canManageContributions(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.CREATE_CONTRIBUTIONS);
}

