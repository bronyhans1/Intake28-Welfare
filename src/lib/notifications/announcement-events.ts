import { emitNotificationSafe } from "@/lib/notifications/engine";
import {
  buildAnnouncementActionUrl,
  NOTIFICATION_EVENT_LABELS,
} from "@/lib/notifications/labels";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationModule,
} from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";
import type { SerializedAnnouncement } from "@/types/announcement";

/**
 * Notify a single recipient that an announcement was published.
 * Callers fan out to visible members / executives as needed.
 */
export async function notifyAnnouncementPublished(
  announcement: Pick<
    SerializedAnnouncement,
    "id" | "title" | "audience"
  >,
  recipient: {
    memberId: string;
    memberName: string;
    serviceNumber: string;
    audience: typeof NotificationAudience.MEMBER | typeof NotificationAudience.EXECUTIVE;
  },
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await emitNotificationSafe({
    eventType: NotificationEventType.ANNOUNCEMENT_PUBLISHED,
    audience: recipient.audience,
    memberId: recipient.memberId,
    memberName: recipient.memberName,
    serviceNumber: recipient.serviceNumber,
    actorId: actor.uid,
    actorName: actor.fullName,
    title: NOTIFICATION_EVENT_LABELS[NotificationEventType.ANNOUNCEMENT_PUBLISHED],
    message: `New announcement: ${announcement.title}`,
    relatedModule: NotificationModule.ANNOUNCEMENTS,
    relatedRecordId: announcement.id,
    actionUrl: buildAnnouncementActionUrl(announcement.id),
    channels: [NotificationChannel.IN_APP],
    metadata: {
      announcementAudience: announcement.audience,
    },
  });
}
