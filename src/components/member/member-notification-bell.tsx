"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  fetchRecentUnreadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { useUnreadNotificationCount } from "@/components/admin/use-unread-notification-count";
import { useToast } from "@/components/providers/toast-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatNotificationMessage,
  formatNotificationTitle,
  getNotificationActionLabel,
} from "@/lib/notifications/labels";
import type { SerializedNotificationEvent } from "@/lib/notifications/types";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";

export function MemberNotificationBell() {
  const router = useRouter();
  const count = useUnreadNotificationCount();
  const { showSuccess } = useToast();
  const [recent, setRecent] = useState<SerializedNotificationEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<{
    type: "read" | "read-all";
    id?: string;
  } | null>(null);

  const isMarkingAll = pendingAction?.type === "read-all";
  const readingId =
    pendingAction?.type === "read" ? pendingAction.id : null;

  useEffect(() => {
    if (!open) return;

    let active = true;
    void fetchRecentUnreadNotificationsAction(5).then((result) => {
      if (active && !result.error) {
        setRecent(result.records);
      }
    });

    return () => {
      active = false;
    };
  }, [open, count]);

  function handleMarkRead(notificationId: string) {
    setPendingAction({ type: "read", id: notificationId });
    startTransition(async () => {
      try {
        await markNotificationReadAction(notificationId);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleMarkAllRead() {
    setPendingAction({ type: "read-all" });
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
        setRecent([]);
        showSuccess("All notifications marked as read.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "relative shrink-0 gap-2 max-sm:px-2",
        )}
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      >
        <Bell className="size-4" />
        <span className="hidden sm:inline">Notifications</span>
        {count > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#166534] px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <span>Recent notifications</span>
          {count > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isMarkingAll}
              onClick={(event) => {
                event.preventDefault();
                handleMarkAllRead();
              }}
            >
              {isMarkingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              {isMarkingAll ? "Marking all as read..." : "Mark all as read"}
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {recent.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No unread notifications.
          </p>
        ) : (
          recent.map((notification) => {
            const title = formatNotificationTitle({
              eventType: notification.eventType,
              title: notification.title,
            });
            const message = formatNotificationMessage({
              eventType: notification.eventType,
              actorName: notification.actorName,
              memberName: notification.memberName,
              title: notification.title,
              message: notification.message,
            });
            const actionLabel = getNotificationActionLabel(
              notification.eventType,
              notification.relatedModule,
            );
            const isReadingThis = readingId === notification.id;

            return (
              <div
                key={notification.id}
                className="rounded-md px-2 py-2 hover:bg-muted/60"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-[#166534]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {message}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time className="text-[11px] text-muted-foreground">
                        {formatDisplayDate(notification.createdAt)}
                      </time>
                      {notification.actionUrl ? (
                        <Link
                          href={notification.actionUrl}
                          className="text-[11px] font-medium text-[#166534] hover:underline"
                          onClick={() => {
                            handleMarkRead(notification.id);
                            setOpen(false);
                          }}
                        >
                          {actionLabel}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                        disabled={isReadingThis}
                        onClick={() => handleMarkRead(notification.id)}
                      >
                        {isReadingThis ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                        {isReadingThis ? "Marking as read..." : "Mark as read"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer justify-center text-sm font-medium text-[#166534]"
          onClick={() => {
            setOpen(false);
            router.push("/portal/notifications");
          }}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
