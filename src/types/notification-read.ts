import type { Timestamp } from "firebase-admin/firestore";
import type { NotificationEventStatus } from "@/lib/notifications/types";

export interface NotificationRead {
  id: string;
  notificationId: string;
  userId: string;
  status: NotificationEventStatus;
  readAt: Timestamp | null;
  archivedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface SerializedNotificationRead {
  id: string;
  notificationId: string;
  userId: string;
  status: NotificationEventStatus;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}
