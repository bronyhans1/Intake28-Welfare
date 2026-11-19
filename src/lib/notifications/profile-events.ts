import {
  emitNotification,
} from "@/lib/notifications/engine";
import {
  formatNotificationEventLabel,
  formatNotificationMessage,
} from "@/lib/notifications/labels";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationModule,
  type ProfileNotificationEventInput,
} from "@/lib/notifications/types";

/**
 * Persists executive-facing profile notification events via the unified engine.
 */
export async function emitProfileNotificationEvent(
  input: ProfileNotificationEventInput,
): Promise<void> {
  const title = formatNotificationEventLabel(input.eventType);
  const message = formatNotificationMessage({
    eventType: input.eventType,
    actorName: input.actorName,
    memberName: input.memberName,
  });

  await emitNotification({
    eventType: input.eventType,
    audience: NotificationAudience.EXECUTIVE,
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    actorId: input.actorId,
    actorName: input.actorName,
    title,
    message,
    relatedModule: NotificationModule.PROFILE,
    relatedRecordId: input.memberId,
    actionUrl: `/admin/members/${input.memberId}`,
    channels: [NotificationChannel.IN_APP],
    metadata: input.metadata ?? {},
  });
}
