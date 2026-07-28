import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { WelfareSupportAuditAction } from "@/lib/welfare/audit";
import type { CreateWelfareSupportInput, UpdateWelfareSupportInput, WelfareSupportListQuery } from "@/lib/validators/welfare-support";
import { WelfareSupportStatus } from "@/types/enums";
import type { SerializedWelfareSupport, WelfareSupport } from "@/types/welfare-support";
import type { CurrentUser } from "@/types/auth";
import { hasPermission, Permission } from "@/lib/auth/permissions";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): WelfareSupport {
  return { id, ...data } as WelfareSupport;
}

function serializeRecord(record: WelfareSupport): SerializedWelfareSupport {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedWelfareSupport>(id, rest as Record<string, unknown>);
}

function deriveReportingFields(now: Date): { supportYear: number; supportMonth: number } {
  return {
    supportYear: now.getFullYear(),
    supportMonth: now.getMonth() + 1, // 1-based
  };
}

export interface WelfareSupportListResult {
  records: SerializedWelfareSupport[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WelfareSupportStats {
  totalRecords: number;
  totalAmount: number;
  membersAssisted: number;
}

async function fetchAllRecords(): Promise<WelfareSupport[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.WELFARE_SUPPORT)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>));
}

export async function getWelfareSupportById(
  recordId: string,
): Promise<SerializedWelfareSupport | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.WELFARE_SUPPORT).doc(recordId).get();

  if (!doc.exists) {
    return null;
  }

  return serializeRecord(mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>));
}

export async function listWelfareSupport(
  query: WelfareSupportListQuery,
): Promise<WelfareSupportListResult> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (query.supportType && record.supportType !== query.supportType) return false;
    if (query.status && record.status !== query.status) return false;
    if (query.memberId && record.memberId !== query.memberId) return false;
    if (query.supportYear && record.supportYear !== query.supportYear) return false;
    if (query.supportMonth && record.supportMonth !== query.supportMonth) return false;
    if (query.search) {
      const search = query.search.toLowerCase();
      const matchesMember = record.memberName.toLowerCase().includes(search);
      const matchesServiceNumber = record.serviceNumber.toLowerCase().includes(search);
      const matchesDescription = record.description.toLowerCase().includes(search);
      if (!matchesMember && !matchesServiceNumber && !matchesDescription) return false;
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

export async function createWelfareSupport(
  input: CreateWelfareSupportInput,
  actor: CurrentUser,
): Promise<{ recordId: string }> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.WELFARE_SUPPORT).doc();
  const now = new Date();
  const reporting = deriveReportingFields(now);

  const document = sanitizeFirestoreData({
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    supportType: input.supportType,
    amount: input.amount,
    description: input.description.trim(),
    status: WelfareSupportStatus.APPROVED,
    approvedBy: actor.uid,
    approvedByName: actor.fullName,
    recordedBy: actor.uid,
    recordedByName: actor.fullName,
    supportYear: reporting.supportYear,
    supportMonth: reporting.supportMonth,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createWelfareSupport", document);

  await ref.set(document);

  await createAuditLog({
    action: WelfareSupportAuditAction.WELFARE_SUPPORT_CREATED,
    entityType: "welfare_support",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: {
      memberId: input.memberId,
      memberName: input.memberName,
      serviceNumber: input.serviceNumber,
      supportType: input.supportType,
      amount: input.amount,
    },
  });

  return { recordId: ref.id };
}

export async function updateWelfareSupport(
  recordId: string,
  input: UpdateWelfareSupportInput,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.WELFARE_SUPPORT).doc(recordId).get();

  if (!doc.exists) {
    throw new Error("Welfare support record not found.");
  }

  const existing = mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);

  const updatePayload = sanitizeFirestoreData({
    supportType: input.supportType,
    amount: input.amount,
    description: input.description.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateWelfareSupport", updatePayload);

  await db.collection(COLLECTIONS.WELFARE_SUPPORT).doc(recordId).update(updatePayload);

  await createAuditLog({
    action: WelfareSupportAuditAction.WELFARE_SUPPORT_UPDATED,
    entityType: "welfare_support",
    entityId: recordId,
    ...buildAuditActor(actor),
    changes: {
      supportType: { before: existing.supportType, after: input.supportType },
      amount: { before: existing.amount, after: input.amount },
      description: { before: existing.description, after: input.description },
    },
    metadata: { memberName: existing.memberName, serviceNumber: existing.serviceNumber },
  });
}

export async function getWelfareSupportStats(
  filters: { memberId?: string; supportYear?: number; supportMonth?: number } = {},
): Promise<WelfareSupportStats> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (filters.memberId && record.memberId !== filters.memberId) return false;
    if (filters.supportYear && record.supportYear !== filters.supportYear) return false;
    if (filters.supportMonth && record.supportMonth !== filters.supportMonth) return false;
    return true;
  });

  const memberIds = new Set(filtered.map((r) => r.memberId));

  return {
    totalRecords: filtered.length,
    totalAmount: filtered.reduce((sum, r) => sum + r.amount, 0),
    membersAssisted: memberIds.size,
  };
}

export function canViewWelfareSupport(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_WELFARE_SUPPORT);
}

export function canManageWelfareSupport(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.CREATE_WELFARE_SUPPORT);
}
