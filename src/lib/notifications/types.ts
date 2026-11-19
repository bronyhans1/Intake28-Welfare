import type { Timestamp } from "firebase-admin/firestore";

/**
 * Delivery channels — In-App is active; SMS / Email / Push are architecture-only.
 */
export const NotificationChannel = {
  IN_APP: "in_app",
  SMS: "sms",
  EMAIL: "email",
  PUSH: "push",
} as const;

export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  [NotificationChannel.IN_APP]: "In-App",
  [NotificationChannel.SMS]: "SMS",
  [NotificationChannel.EMAIL]: "Email",
  [NotificationChannel.PUSH]: "Push",
};

/** Who should see the notification in their inbox */
export const NotificationAudience = {
  MEMBER: "member",
  EXECUTIVE: "executive",
} as const;

export type NotificationAudience =
  (typeof NotificationAudience)[keyof typeof NotificationAudience];

/** Related platform module — keep claim-specific logic out of the engine */
export const NotificationModule = {
  PROFILE: "profile",
  RECEIPTS: "receipts",
  CLAIMS: "claims",
  CONTRIBUTIONS: "contributions",
  PAYMENTS: "payments",
  ANNOUNCEMENTS: "announcements",
  SYSTEM: "system",
} as const;

export type NotificationModule =
  (typeof NotificationModule)[keyof typeof NotificationModule];

export const NotificationEventType = {
  PROFILE_EMAIL_CHANGED: "profile_email_changed",
  PROFILE_PHONE_CHANGED: "profile_phone_changed",
  PROFILE_PHOTO_CHANGED: "profile_photo_changed",
  PROFILE_RANK_CHANGED: "profile_rank_changed",
  PROFILE_STATION_CHANGED: "profile_station_changed",
  PROFILE_NEXT_OF_KIN_CHANGED: "profile_next_of_kin_changed",
  PROFILE_EMERGENCY_CONTACT_CHANGED: "profile_emergency_contact_changed",
  RECEIPT_GENERATED: "receipt_generated",
  RECEIPT_DOWNLOADED: "receipt_downloaded",
  CLAIM_SUBMITTED: "claim_submitted",
  CLAIM_RETURNED: "claim_returned",
  CLAIM_APPROVED: "claim_approved",
  CLAIM_REJECTED: "claim_rejected",
  CLAIM_SENT_TO_FINANCE: "claim_sent_to_finance",
  CLAIM_PAID: "claim_paid",
  CONTRIBUTION_RECEIVED: "contribution_received",
  PAYMENT_RECORDED: "payment_recorded",
  ANNOUNCEMENT_PUBLISHED: "announcement_published",
  MEMBERSHIP_REQUEST_SUBMITTED: "membership_request_submitted",
  MEMBERSHIP_REQUEST_APPROVED: "membership_request_approved",
  MEMBERSHIP_REQUEST_DECLINED: "membership_request_declined",
} as const;

export type NotificationEventType =
  (typeof NotificationEventType)[keyof typeof NotificationEventType];

export const NotificationEventStatus = {
  UNREAD: "unread",
  READ: "read",
  ARCHIVED: "archived",
} as const;

export type NotificationEventStatus =
  (typeof NotificationEventStatus)[keyof typeof NotificationEventStatus];

/**
 * Channel delivery placeholders — SMS/Email/Push remain pending until providers are wired.
 */
export type NotificationChannelDelivery = {
  channel: NotificationChannel;
  status: "pending" | "sent" | "failed" | "skipped";
  provider?: string | null;
  error?: string | null;
};

export interface EmitNotificationInput {
  eventType: NotificationEventType;
  audience: NotificationAudience;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  actorId: string;
  actorName: string;
  title: string;
  message: string;
  relatedModule: NotificationModule;
  relatedRecordId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  /** Defaults to In-App only */
  channels?: NotificationChannel[];
}

export interface ProfileNotificationEventInput {
  memberId: string;
  memberName: string;
  serviceNumber: string;
  eventType: NotificationEventType;
  actorId: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationEvent {
  id: string;
  eventType: NotificationEventType;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  actorId: string;
  actorName: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Inbox audience — legacy events without this default to executive */
  audience?: NotificationAudience | null;
  title?: string | null;
  message?: string | null;
  relatedModule?: NotificationModule | null;
  relatedRecordId?: string | null;
  actionUrl?: string | null;
  channels?: NotificationChannel[];
  channelDeliveries?: NotificationChannelDelivery[];
  /** @deprecated Legacy global status — ignored; use notification_reads */
  status?: NotificationEventStatus;
  /** @deprecated Legacy global read timestamp — ignored */
  readAt?: Timestamp | null;
  /** @deprecated Legacy global archive timestamp — ignored */
  archivedAt?: Timestamp | null;
}

export interface SerializedNotificationEvent {
  id: string;
  eventType: NotificationEventType;
  status: NotificationEventStatus;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  actorId: string;
  actorName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  archivedAt: string | null;
  audience: NotificationAudience;
  title: string | null;
  message: string | null;
  relatedModule: NotificationModule | null;
  relatedRecordId: string | null;
  actionUrl: string | null;
  channels: NotificationChannel[];
  channelDeliveries: NotificationChannelDelivery[];
}
