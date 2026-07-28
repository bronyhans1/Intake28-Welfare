import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { NotificationEventStatus } from "@/lib/notifications/types";
import type { NotificationRead } from "@/types/notification-read";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): NotificationRead {
  return { id, ...data } as NotificationRead;
}

function readStateDocId(userId: string, notificationId: string): string {
  return `${userId}__${notificationId}`;
}

async function fetchReadStatesForUser(userId: string): Promise<Map<string, NotificationRead>> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.NOTIFICATION_READS)
    .where("userId", "==", userId)
    .get();

  const map = new Map<string, NotificationRead>();
  for (const doc of snapshot.docs) {
    const record = mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);
    map.set(record.notificationId, record);
  }
  return map;
}

export function resolveUserNotificationStatus(
  readState: NotificationRead | undefined,
): NotificationEventStatus {
  if (!readState) {
    return NotificationEventStatus.UNREAD;
  }
  return readState.status;
}

export async function getNotificationReadState(
  notificationId: string,
  userId: string,
): Promise<NotificationRead | null> {
  const db = getAdminDb();
  const doc = await db
    .collection(COLLECTIONS.NOTIFICATION_READS)
    .doc(readStateDocId(userId, notificationId))
    .get();

  if (!doc.exists) {
    return null;
  }

  return mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>);
}

async function upsertNotificationReadState(
  notificationId: string,
  userId: string,
  status: NotificationEventStatus,
  timestamps: {
    readAt?: ReturnType<typeof FieldValue.serverTimestamp> | null;
    archivedAt?: ReturnType<typeof FieldValue.serverTimestamp> | null;
  } = {},
): Promise<void> {
  const db = getAdminDb();
  const ref = db
    .collection(COLLECTIONS.NOTIFICATION_READS)
    .doc(readStateDocId(userId, notificationId));

  const existing = await ref.get();
  const payload = sanitizeFirestoreData({
    notificationId,
    userId,
    status,
    readAt: timestamps.readAt ?? null,
    archivedAt: timestamps.archivedAt ?? null,
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  });

  warnInvalidFirestorePayload("upsertNotificationReadState", payload);

  if (existing.exists) {
    await ref.update(payload);
    return;
  }

  await ref.set(payload);
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const existing = await getNotificationReadState(notificationId, userId);
  if (existing?.status === NotificationEventStatus.ARCHIVED) {
    return;
  }

  await upsertNotificationReadState(notificationId, userId, NotificationEventStatus.READ, {
    readAt: FieldValue.serverTimestamp(),
    archivedAt: null,
  });
}

export async function archiveNotification(
  notificationId: string,
  userId: string,
): Promise<void> {
  await upsertNotificationReadState(
    notificationId,
    userId,
    NotificationEventStatus.ARCHIVED,
    {
      archivedAt: FieldValue.serverTimestamp(),
      readAt: FieldValue.serverTimestamp(),
    },
  );
}

export async function markAllNotificationsRead(
  userId: string,
  notificationIds: string[],
): Promise<number> {
  const readStates = await fetchReadStatesForUser(userId);
  let updated = 0;

  for (const notificationId of notificationIds) {
    const current = readStates.get(notificationId);
    if (current?.status === NotificationEventStatus.READ) {
      continue;
    }
    if (current?.status === NotificationEventStatus.ARCHIVED) {
      continue;
    }

    await markNotificationRead(notificationId, userId);
    updated += 1;
  }

  return updated;
}

export async function getUserReadStateMap(
  userId: string,
): Promise<Map<string, NotificationRead>> {
  return fetchReadStatesForUser(userId);
}
