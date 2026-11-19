import Link from "next/link";
import {
  formatNotificationMessage,
  formatNotificationTitle,
  getNotificationActionLabel,
} from "@/lib/notifications/labels";
import type { SerializedNotificationEvent } from "@/lib/notifications/types";
import { formatDisplayDate } from "@/lib/utils/format-date";

interface RecentNotificationsProps {
  notifications: SerializedNotificationEvent[];
}

export function RecentNotifications({ notifications }: RecentNotificationsProps) {
  if (notifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No unread notifications.</p>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <Link
          key={notification.id}
          href={notification.actionUrl ?? "/admin/notifications"}
          className="block rounded-xl border border-black/[0.06] px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {formatNotificationTitle({
                  eventType: notification.eventType,
                  title: notification.title,
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNotificationMessage({
                  eventType: notification.eventType,
                  actorName: notification.actorName,
                  memberName: notification.memberName,
                  title: notification.title,
                  message: notification.message,
                })}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {notification.memberName} ({notification.serviceNumber})
                {notification.actionUrl
                  ? ` · ${getNotificationActionLabel(notification.eventType, notification.relatedModule)}`
                  : ""}
              </p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">
              {formatDisplayDate(notification.createdAt)}
            </time>
          </div>
        </Link>
      ))}
    </div>
  );
}
