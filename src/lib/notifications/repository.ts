import { hasPermission, Permission } from "@/lib/auth/permissions";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import {
  emitNotificationSafe,
  resolveNotificationAudience,
} from "@/lib/notifications/engine";
import {
  archiveNotification as archiveNotificationForUser,
  getUserReadStateMap,
  markAllNotificationsRead,
  markNotificationRead,
  resolveUserNotificationStatus,
} from "@/lib/notifications/read-repository";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventStatus,
  NotificationModule,
  type NotificationChannelDelivery,
  type NotificationEvent,
  type SerializedNotificationEvent,
} from "@/lib/notifications/types";
import type { NotificationRead } from "@/types/notification-read";
import type { CurrentUser } from "@/types/auth";
import { UserRole } from "@/types/enums";
import { z } from "zod";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): NotificationEvent {
  return { id, ...data } as NotificationEvent;
}

function serializeRecord(
  record: NotificationEvent,
  readState: NotificationRead | undefined,
): SerializedNotificationEvent {
  const status = resolveUserNotificationStatus(readState);
  const {
    id,
    status: _legacyStatus,
    readAt: _legacyReadAt,
    archivedAt: _legacyArchivedAt,
    ...eventFields
  } = record;
  void _legacyStatus;
  void _legacyReadAt;
  void _legacyArchivedAt;

  const audience = resolveNotificationAudience(record.audience);
  const channels = record.channels?.length
    ? record.channels
    : [NotificationChannel.IN_APP];
  const channelDeliveries: NotificationChannelDelivery[] =
    record.channelDeliveries ??
    channels.map((channel) => ({
      channel,
      status: channel === NotificationChannel.IN_APP ? "sent" : "pending",
      provider: channel === NotificationChannel.IN_APP ? "firestore" : null,
      error: null,
    }));

  return serializeFirestoreDoc(id, {
    ...eventFields,
    audience,
    title: record.title ?? null,
    message: record.message ?? null,
    relatedModule: record.relatedModule ?? null,
    relatedRecordId: record.relatedRecordId ?? null,
    actionUrl: record.actionUrl ?? null,
    channels,
    channelDeliveries,
    status,
    readAt: readState?.readAt ?? null,
    archivedAt: readState?.archivedAt ?? null,
  }) as unknown as SerializedNotificationEvent;
}

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum([
      NotificationEventStatus.UNREAD,
      NotificationEventStatus.READ,
      NotificationEventStatus.ARCHIVED,
      "all",
    ])
    .default("all"),
  search: z.string().trim().optional(),
  audience: z
    .enum([NotificationAudience.MEMBER, NotificationAudience.EXECUTIVE, "all"])
    .optional()
    .default("all"),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export interface NotificationListResult {
  records: SerializedNotificationEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unreadCount: number;
}

export function canViewNotifications(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_NOTIFICATIONS);
}

export function canViewOwnNotifications(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.VIEW_OWN_NOTIFICATIONS);
}

export function canManageNotifications(role: CurrentUser["role"]): boolean {
  return hasPermission(role, Permission.MANAGE_NOTIFICATIONS);
}

export function canAccessNotificationCentre(role: CurrentUser["role"]): boolean {
  return canViewNotifications(role) || canViewOwnNotifications(role);
}

async function fetchAllEvents(): Promise<NotificationEvent[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.NOTIFICATION_EVENTS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

function matchesSearch(record: NotificationEvent, search?: string): boolean {
  if (!search?.trim()) return true;
  const term = search.trim().toLowerCase();
  return (
    record.memberName.toLowerCase().includes(term) ||
    record.serviceNumber.toLowerCase().includes(term) ||
    record.actorName.toLowerCase().includes(term) ||
    record.eventType.toLowerCase().includes(term) ||
    (record.title ?? "").toLowerCase().includes(term) ||
    (record.message ?? "").toLowerCase().includes(term)
  );
}

/** Events visible in a user's personal inbox */
export function isEventVisibleToUser(
  event: NotificationEvent,
  actor: Pick<CurrentUser, "uid" | "role">,
): boolean {
  const audience = resolveNotificationAudience(event.audience);

  if (actor.role === UserRole.MEMBER) {
    return (
      audience === NotificationAudience.MEMBER && event.memberId === actor.uid
    );
  }

  // Administrators / Treasurers: full delivery history
  if (canViewNotifications(actor.role)) {
    return true;
  }

  return false;
}

function countUnreadForUser(
  events: NotificationEvent[],
  readStates: Map<string, NotificationRead>,
): number {
  return events.filter(
    (event) =>
      resolveUserNotificationStatus(readStates.get(event.id)) ===
      NotificationEventStatus.UNREAD,
  ).length;
}

export async function listNotificationsForUser(
  actor: CurrentUser,
  query: NotificationListQuery,
): Promise<NotificationListResult> {
  const [events, readStates] = await Promise.all([
    fetchAllEvents(),
    getUserReadStateMap(actor.uid),
  ]);

  const visibleEvents = events.filter((event) =>
    isEventVisibleToUser(event, actor),
  );

  const unreadCount = countUnreadForUser(visibleEvents, readStates);

  const filtered = visibleEvents.filter((event) => {
    const status = resolveUserNotificationStatus(readStates.get(event.id));
    if (query.status !== "all" && status !== query.status) {
      return false;
    }
    if (query.audience && query.audience !== "all") {
      if (resolveNotificationAudience(event.audience) !== query.audience) {
        return false;
      }
    }
    return matchesSearch(event, query.search);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const pageRecords = filtered.slice(start, start + query.pageSize);

  return {
    records: pageRecords.map((event) =>
      serializeRecord(event, readStates.get(event.id)),
    ),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
    unreadCount,
  };
}

export async function getUnreadNotificationCount(
  actor: CurrentUser,
): Promise<number> {
  const [events, readStates] = await Promise.all([
    fetchAllEvents(),
    getUserReadStateMap(actor.uid),
  ]);
  const visibleEvents = events.filter((event) =>
    isEventVisibleToUser(event, actor),
  );
  return countUnreadForUser(visibleEvents, readStates);
}

export async function getRecentUnreadNotifications(
  actor: CurrentUser,
  limit = 5,
): Promise<SerializedNotificationEvent[]> {
  const [events, readStates] = await Promise.all([
    fetchAllEvents(),
    getUserReadStateMap(actor.uid),
  ]);

  return events
    .filter((event) => isEventVisibleToUser(event, actor))
    .filter(
      (event) =>
        resolveUserNotificationStatus(readStates.get(event.id)) ===
        NotificationEventStatus.UNREAD,
    )
    .slice(0, limit)
    .map((event) => serializeRecord(event, readStates.get(event.id)));
}

export async function markNotificationAsRead(
  notificationId: string,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  const eventDoc = await db
    .collection(COLLECTIONS.NOTIFICATION_EVENTS)
    .doc(notificationId)
    .get();
  if (!eventDoc.exists) {
    throw new Error("Notification not found.");
  }

  const event = mapFirestoreDoc(
    eventDoc.id,
    eventDoc.data() as Record<string, unknown>,
  );
  if (!isEventVisibleToUser(event, actor)) {
    throw new Error("You do not have permission to update this notification.");
  }

  await markNotificationRead(notificationId, actor.uid);
}

export async function markAllNotificationsAsRead(
  actor: CurrentUser,
): Promise<number> {
  const events = await fetchAllEvents();
  const visibleIds = events
    .filter((event) => isEventVisibleToUser(event, actor))
    .map((event) => event.id);
  return markAllNotificationsRead(actor.uid, visibleIds);
}

export async function archiveNotification(
  notificationId: string,
  actor: CurrentUser,
): Promise<void> {
  if (!canManageNotifications(actor.role)) {
    throw new Error("You do not have permission to archive notifications.");
  }

  const db = getAdminDb();
  const eventDoc = await db
    .collection(COLLECTIONS.NOTIFICATION_EVENTS)
    .doc(notificationId)
    .get();
  if (!eventDoc.exists) {
    throw new Error("Notification not found.");
  }

  await archiveNotificationForUser(notificationId, actor.uid);
}

export { emitNotificationSafe, NotificationModule };

export { getNotificationReadState } from "@/lib/notifications/read-repository";
