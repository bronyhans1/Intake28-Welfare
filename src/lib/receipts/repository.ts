import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { ReceiptAuditAction } from "@/lib/receipts/audit";
import { generateReceiptNumber } from "@/lib/receipts/number";
import type { ReceiptListQuery } from "@/lib/validators/receipts";
import { ReceiptStatus, type Receipt, type SerializedReceipt } from "@/types/receipt";
import type { CurrentUser } from "@/types/auth";
import type { ContributionType, SettingsCurrency } from "@/types/enums";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): Receipt {
  return { id, ...data } as Receipt;
}

function serializeRecord(record: Receipt): SerializedReceipt {
  const { id, ...rest } = record;
  return serializeFirestoreDoc(id, rest as Record<string, unknown>) as unknown as SerializedReceipt;
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

export interface ReceiptListResult {
  records: SerializedReceipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReceiptStats {
  totalReceipts: number;
  issuedReceipts: number;
  cancelledReceipts: number;
  totalAmount: number;
}

export interface CreateReceiptInput {
  paymentId: string;
  paymentReference: string;
  contributionId: string;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  contributionType: ContributionType;
  amount: number;
  currency: SettingsCurrency;
  issuedBy: string;
}

export function canViewReceipts(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_RECEIPTS);
}

export function canDownloadReceipts(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.DOWNLOAD_RECEIPTS);
}

async function fetchAllRecords(): Promise<Receipt[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.RECEIPTS)
    .orderBy("issuedAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

function receiptNumberExists(records: Receipt[], receiptNumber: string): boolean {
  return records.some((record) => record.receiptNumber === receiptNumber);
}

function matchesReceiptQuery(
  record: Receipt,
  query: ReceiptListQuery,
): boolean {
  if (query.status && record.status !== query.status) {
    return false;
  }

  if (query.month || query.year) {
    const issuedAt = toDate(record.issuedAt);
    if (!issuedAt) return false;
    if (query.month && issuedAt.getMonth() + 1 !== query.month) return false;
    if (query.year && issuedAt.getFullYear() !== query.year) return false;
  }

  if (query.memberId && record.memberId !== query.memberId) {
    return false;
  }

  if (query.search?.trim()) {
    const term = query.search.trim().toLowerCase();
    const matches =
      record.receiptNumber.toLowerCase().includes(term) ||
      record.paymentReference.toLowerCase().includes(term) ||
      record.memberName.toLowerCase().includes(term) ||
      record.serviceNumber.toLowerCase().includes(term);
    if (!matches) return false;
  }

  return true;
}

function paginateReceipts(
  records: Receipt[],
  query: ReceiptListQuery,
): ReceiptListResult {
  const filtered = records.filter((record) => matchesReceiptQuery(record, query));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    records: filtered.slice(start, start + query.pageSize).map(serializeRecord),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export interface CreateReceiptResult {
  receipt: SerializedReceipt;
  created: boolean;
}

export async function createReceipt(input: CreateReceiptInput): Promise<CreateReceiptResult> {
  const db = getAdminDb();
  const receiptRef = db.collection(COLLECTIONS.RECEIPTS).doc(input.paymentReference);

  const existingDoc = await receiptRef.get();
  if (existingDoc.exists) {
    return {
      receipt: serializeRecord(
        mapFirestoreDoc(existingDoc.id, existingDoc.data() as Record<string, unknown>),
      ),
      created: false,
    };
  }

  const allRecords = await fetchAllRecords();

  let receiptNumber = generateReceiptNumber();
  let attempts = 0;
  while (receiptNumberExists(allRecords, receiptNumber) && attempts < 10) {
    receiptNumber = generateReceiptNumber();
    attempts += 1;
  }

  if (receiptNumberExists(allRecords, receiptNumber)) {
    throw new Error("Unable to generate a unique receipt number.");
  }

  const document = sanitizeFirestoreData({
    receiptNumber,
    paymentId: input.paymentId,
    paymentReference: input.paymentReference,
    contributionId: input.contributionId,
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    contributionType: input.contributionType,
    amount: input.amount,
    currency: input.currency,
    status: ReceiptStatus.ISSUED,
    issuedAt: FieldValue.serverTimestamp(),
    issuedBy: input.issuedBy,
    createdAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createReceipt", document);

  let created = false;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(receiptRef);
    if (snapshot.exists) {
      return;
    }

    transaction.create(receiptRef, document);
    created = true;
  });

  const finalDoc = await receiptRef.get();
  if (!finalDoc.exists) {
    throw new Error("Failed to create receipt.");
  }

  return {
    receipt: serializeRecord(
      mapFirestoreDoc(finalDoc.id, finalDoc.data() as Record<string, unknown>),
    ),
    created,
  };
}

export async function getReceiptById(
  receiptId: string,
): Promise<SerializedReceipt | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.RECEIPTS).doc(receiptId).get();
  if (!doc.exists) return null;
  return serializeRecord(mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>));
}

export async function getReceiptByNumber(
  receiptNumber: string,
): Promise<SerializedReceipt | null> {
  const records = await fetchAllRecords();
  const record = records.find((item) => item.receiptNumber === receiptNumber);
  return record ? serializeRecord(record) : null;
}

export async function getReceiptByPaymentReference(
  paymentReference: string,
): Promise<SerializedReceipt | null> {
  const db = getAdminDb();
  const directDoc = await db.collection(COLLECTIONS.RECEIPTS).doc(paymentReference).get();
  if (directDoc.exists) {
    return serializeRecord(
      mapFirestoreDoc(directDoc.id, directDoc.data() as Record<string, unknown>),
    );
  }

  const legacySnapshot = await db
    .collection(COLLECTIONS.RECEIPTS)
    .where("paymentReference", "==", paymentReference)
    .limit(1)
    .get();

  if (legacySnapshot.empty) {
    return null;
  }

  const legacyDoc = legacySnapshot.docs[0];
  return serializeRecord(
    mapFirestoreDoc(legacyDoc.id, legacyDoc.data() as Record<string, unknown>),
  );
}

export async function listReceipts(
  query: ReceiptListQuery,
): Promise<ReceiptListResult> {
  const records = await fetchAllRecords();
  return paginateReceipts(records, query);
}

export async function listMemberReceipts(
  memberId: string,
  query: ReceiptListQuery,
): Promise<ReceiptListResult> {
  const records = (await fetchAllRecords()).filter(
    (record) => record.memberId === memberId,
  );
  return paginateReceipts(records, query);
}

export async function getReceiptStats(options?: {
  memberId?: string;
}): Promise<ReceiptStats> {
  const records = await fetchAllRecords();
  const scoped = options?.memberId
    ? records.filter((record) => record.memberId === options.memberId)
    : records;

  const issued = scoped.filter((record) => record.status === ReceiptStatus.ISSUED);

  return {
    totalReceipts: scoped.length,
    issuedReceipts: issued.length,
    cancelledReceipts: scoped.filter((record) => record.status === ReceiptStatus.CANCELLED)
      .length,
    totalAmount: issued.reduce((sum, record) => sum + record.amount, 0),
  };
}

export async function logReceiptGeneratedAudit(
  receipt: SerializedReceipt,
  actor: CurrentUser,
): Promise<void> {
  await createAuditLog({
    action: ReceiptAuditAction.RECEIPT_GENERATED,
    entityType: "receipt",
    entityId: receipt.id,
    ...buildAuditActor(actor),
    metadata: {
      receiptNumber: receipt.receiptNumber,
      paymentReference: receipt.paymentReference,
      contributionId: receipt.contributionId,
      memberId: receipt.memberId,
      memberName: receipt.memberName,
      serviceNumber: receipt.serviceNumber,
      amount: receipt.amount,
    },
  });
}

export async function logReceiptDownloadedAudit(
  receipt: SerializedReceipt,
  actor: CurrentUser,
): Promise<void> {
  await createAuditLog({
    action: ReceiptAuditAction.RECEIPT_DOWNLOADED,
    entityType: "receipt",
    entityId: receipt.id,
    ...buildAuditActor(actor),
    metadata: {
      receiptNumber: receipt.receiptNumber,
      paymentReference: receipt.paymentReference,
      memberId: receipt.memberId,
      memberName: receipt.memberName,
      serviceNumber: receipt.serviceNumber,
    },
  });
}
