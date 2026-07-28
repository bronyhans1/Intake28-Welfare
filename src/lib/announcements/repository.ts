import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { AnnouncementAuditAction } from "@/lib/announcements/audit";
import {
  filterVisibleAnnouncements,
  type AnnouncementViewerContext,
} from "@/lib/announcements/visibility";
import { getDefaulters } from "@/lib/finance/defaulters";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { getDefaultAnnouncementExpiryDays } from "@/lib/system-settings/repository";
import { getMemberById } from "@/lib/members/repository";
import { fanOutAnnouncementPublishedNotifications } from "@/lib/notifications/announcement-fanout";
import type {
  AnnouncementListQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/lib/validators/announcements";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { AnnouncementStatus, UserRole, UserStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { Announcement, SerializedAnnouncement } from "@/types/announcement";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): Announcement {
  return { id, ...data } as Announcement;
}

function serializeRecord(record: Announcement): SerializedAnnouncement {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedAnnouncement>(id, rest as Record<string, unknown>);
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveAnnouncementExpiresAt(
  inputExpiresAt: string | null | undefined,
  now: Date,
): Promise<Date | null> {
  const parsed = parseOptionalDate(inputExpiresAt);
  if (parsed) {
    return parsed;
  }

  const expiryDays = await getDefaultAnnouncementExpiryDays();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  return expiresAt;
}

function parseDateBoundary(value: string | undefined, endOfDay = false): number | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed.getTime();
}

async function fetchAllRecords(): Promise<Announcement[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.ANNOUNCEMENTS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export interface AnnouncementListResult {
  records: SerializedAnnouncement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function canViewAnnouncements(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_ANNOUNCEMENTS);
}

export function canManageAnnouncements(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.MANAGE_ANNOUNCEMENTS);
}

export function canArchiveAnnouncements(role: CurrentUser["role"]): boolean {
  return role === UserRole.ADMIN;
}

export async function getAnnouncementById(
  recordId: string,
): Promise<SerializedAnnouncement | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(recordId).get();

  if (!doc.exists) {
    return null;
  }

  return serializeRecord(
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

export async function listAnnouncements(
  query: AnnouncementListQuery,
): Promise<AnnouncementListResult> {
  const records = await fetchAllRecords();

  const filtered = records.filter((record) => {
    if (query.audience && record.audience !== query.audience) return false;
    if (query.status && record.status !== query.status) return false;

    if (query.search) {
      const search = query.search.toLowerCase();
      const matchesTitle = record.title.toLowerCase().includes(search);
      const matchesMessage = record.message.toLowerCase().includes(search);
      const matchesCreator = record.createdByName.toLowerCase().includes(search);
      if (!matchesTitle && !matchesMessage && !matchesCreator) return false;
    }

    if (query.publishedFrom || query.publishedTo) {
      if (!record.publishedAt) return false;
      const publishedAt = record.publishedAt.toDate().getTime();
      const from = parseDateBoundary(query.publishedFrom);
      const to = parseDateBoundary(query.publishedTo, true);
      if (from != null && publishedAt < from) return false;
      if (to != null && publishedAt > to) return false;
    }

    return true;
  });

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

export async function getPublishedAnnouncementCount(): Promise<number> {
  const records = await fetchAllRecords();
  return records.filter((record) => record.status === AnnouncementStatus.PUBLISHED).length;
}

export async function getRecentPublishedAnnouncements(
  limit = 5,
): Promise<SerializedAnnouncement[]> {
  const records = await fetchAllRecords();

  return records
    .filter((record) => record.status === AnnouncementStatus.PUBLISHED)
    .slice(0, limit)
    .map(serializeRecord);
}

async function buildViewerContext(user: CurrentUser): Promise<AnnouncementViewerContext> {
  const member = await getMemberById(user.uid);
  const defaulters = await getDefaulters();
  const isDefaulter = defaulters.some((record) => record.memberId === user.uid);

  return {
    userId: user.uid,
    role: user.role,
    status: (member?.status as UserStatus) ?? UserStatus.ACTIVE,
    isDefaulter,
  };
}

export async function listVisibleAnnouncementsForUser(
  user: CurrentUser,
): Promise<SerializedAnnouncement[]> {
  const [records, viewer] = await Promise.all([
    fetchAllRecords(),
    buildViewerContext(user),
  ]);

  const serialized = records.map(serializeRecord);
  return filterVisibleAnnouncements(serialized, viewer).sort((left, right) => {
    const leftDate = left.publishedAt ?? left.createdAt;
    const rightDate = right.publishedAt ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export async function getLatestVisibleAnnouncementForUser(
  user: CurrentUser,
): Promise<SerializedAnnouncement | null> {
  const visible = await listVisibleAnnouncementsForUser(user);
  return visible[0] ?? null;
}

export async function getVisibleAnnouncementCountForUser(
  user: CurrentUser,
): Promise<number> {
  const visible = await listVisibleAnnouncementsForUser(user);
  return visible.length;
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  actor: CurrentUser,
): Promise<{ recordId: string }> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.ANNOUNCEMENTS).doc();
  const now = new Date();
  const shouldPublish = Boolean(input.publishNow) || input.status === AnnouncementStatus.PUBLISHED;
  const status = shouldPublish ? AnnouncementStatus.PUBLISHED : AnnouncementStatus.DRAFT;
  const expiresAt = await resolveAnnouncementExpiresAt(input.expiresAt, now);

  const document = sanitizeFirestoreData({
    title: input.title.trim(),
    message: input.message.trim(),
    audience: input.audience,
    status,
    publishedAt: shouldPublish ? Timestamp.fromDate(now) : null,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    createdBy: actor.uid,
    createdByName: actor.fullName,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createAnnouncement", document);
  await ref.set(document);

  const auditActor = buildAuditActor(actor);

  await createAuditLog({
    action: AnnouncementAuditAction.ANNOUNCEMENT_CREATED,
    entityType: "announcement",
    entityId: ref.id,
    ...auditActor,
    metadata: {
      title: input.title.trim(),
      audience: input.audience,
      status,
    },
  });

  if (shouldPublish) {
    await createAuditLog({
      action: AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED,
      entityType: "announcement",
      entityId: ref.id,
      ...auditActor,
      metadata: {
        title: input.title.trim(),
        audience: input.audience,
      },
    });

    await fanOutAnnouncementPublishedNotifications(
      {
        id: ref.id,
        title: input.title.trim(),
        audience: input.audience,
        status: AnnouncementStatus.PUBLISHED,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
      actor,
    ).catch((error) => {
      console.error("[notifications] Announcement fan-out failed", error);
    });
  }

  return { recordId: ref.id };
}

export async function updateAnnouncement(
  recordId: string,
  input: UpdateAnnouncementInput,
  actor: CurrentUser,
): Promise<void> {
  if (
    input.status === AnnouncementStatus.ARCHIVED &&
    !canArchiveAnnouncements(actor.role)
  ) {
    throw new Error("You do not have permission to archive announcements.");
  }

  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(recordId).get();

  if (!doc.exists) {
    throw new Error("Announcement not found.");
  }

  const existing = mapFirestoreDoc(recordId, doc.data() as Record<string, unknown>);
  const expiresAt = parseOptionalDate(input.expiresAt);
  const now = new Date();
  const auditActor = buildAuditActor(actor);
  const shouldSetPublishedAt =
    input.status === AnnouncementStatus.PUBLISHED &&
    existing.status !== AnnouncementStatus.PUBLISHED;

  const updatePayload = sanitizeFirestoreData({
    title: input.title.trim(),
    message: input.message.trim(),
    audience: input.audience,
    status: input.status,
    publishedAt: shouldSetPublishedAt
      ? Timestamp.fromDate(now)
      : existing.publishedAt ?? null,
    expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateAnnouncement", updatePayload);
  await db.collection(COLLECTIONS.ANNOUNCEMENTS).doc(recordId).update(updatePayload);

  await createAuditLog({
    action: AnnouncementAuditAction.ANNOUNCEMENT_UPDATED,
    entityType: "announcement",
    entityId: recordId,
    ...auditActor,
    changes: {
      title: { before: existing.title, after: input.title.trim() },
      audience: { before: existing.audience, after: input.audience },
      status: { before: existing.status, after: input.status },
    },
    metadata: {
      title: input.title.trim(),
      audience: input.audience,
      status: input.status,
    },
  });

  if (
    input.status === AnnouncementStatus.PUBLISHED &&
    existing.status !== AnnouncementStatus.PUBLISHED
  ) {
    await createAuditLog({
      action: AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED,
      entityType: "announcement",
      entityId: recordId,
      ...auditActor,
      metadata: {
        title: input.title.trim(),
        audience: input.audience,
      },
    });

    await fanOutAnnouncementPublishedNotifications(
      {
        id: recordId,
        title: input.title.trim(),
        audience: input.audience,
        status: AnnouncementStatus.PUBLISHED,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
      actor,
    ).catch((error) => {
      console.error("[notifications] Announcement fan-out failed", error);
    });
  }

  if (
    input.status === AnnouncementStatus.ARCHIVED &&
    existing.status !== AnnouncementStatus.ARCHIVED
  ) {
    await createAuditLog({
      action: AnnouncementAuditAction.ANNOUNCEMENT_ARCHIVED,
      entityType: "announcement",
      entityId: recordId,
      ...auditActor,
      metadata: {
        title: input.title.trim(),
        audience: input.audience,
      },
    });
  }
}
