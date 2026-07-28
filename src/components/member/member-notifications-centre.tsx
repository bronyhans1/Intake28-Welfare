"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { PageLoader } from "@/components/loading/page-loader";
import { useToast } from "@/components/providers/toast-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatNotificationEventLabel,
  formatNotificationMessage,
  formatNotificationTitle,
  getNotificationActionLabel,
} from "@/lib/notifications/labels";
import { NotificationEventStatus } from "@/lib/notifications/types";
import type { NotificationListResult } from "@/lib/notifications/repository";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";

const FILTER_ALL = "all";

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (!value || value === FILTER_ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  if ("status" in updates || "page" in updates) {
    if (!("page" in updates)) {
      params.delete("page");
    }
  }
  return params.toString();
}

interface MemberNotificationsCentreProps {
  data: NotificationListResult;
}

export function MemberNotificationsCentre({
  data,
}: MemberNotificationsCentreProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess } = useToast();
  const [isNavPending, startNavTransition] = useTransition();
  const [, startActionTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<{
    type: "read" | "read-all";
    id?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const status = searchParams.get("status") ?? FILTER_ALL;
  const isMarkingAll = pendingAction?.type === "read-all";
  const readingId =
    pendingAction?.type === "read" ? pendingAction.id : null;

  function updateFilters(updates: Record<string, string | undefined>) {
    startNavTransition(() => {
      const query = buildQuery(searchParams, updates);
      router.push(query ? `/portal/notifications?${query}` : "/portal/notifications");
    });
  }

  function handleMarkRead(notificationId: string) {
    setActionError(null);
    setPendingAction({ type: "read", id: notificationId });
    startActionTransition(async () => {
      try {
        const result = await markNotificationReadAction(notificationId);
        if (result.error) {
          setActionError(result.error);
          return;
        }
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleMarkAllRead() {
    setActionError(null);
    setPendingAction({ type: "read-all" });
    startActionTransition(async () => {
      try {
        const result = await markAllNotificationsReadAction();
        if (result.error) {
          setActionError(result.error);
          return;
        }
        showSuccess("All notifications marked as read.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  useEffect(() => {
    setActionError(null);
  }, [status, data.page]);

  return (
    <div className="space-y-4">
      {isNavPending ? (
        <PageLoader compact label="Loading Notifications..." />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xs space-y-2">
          <Label>Filter</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              const next = value ?? FILTER_ALL;
              updateFilters({
                status: next === FILTER_ALL ? undefined : next,
                page: undefined,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All notifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All</SelectItem>
              <SelectItem value={NotificationEventStatus.UNREAD}>Unread</SelectItem>
              <SelectItem value={NotificationEventStatus.READ}>Read</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Marking all as read...
              </>
            ) : (
              <>
                <CheckCheck className="size-4" />
                Mark all as read
              </>
            )}
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Sorted newest first
        {data.unreadCount > 0
          ? ` · ${data.unreadCount} unread`
          : " · All caught up"}
      </p>

      <div className="space-y-3">
        {data.records.length === 0 ? (
          <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-10 text-center text-sm text-muted-foreground">
            No notifications found.
          </div>
        ) : (
          data.records.map((record) => {
            const unread = record.status === NotificationEventStatus.UNREAD;
            const title = formatNotificationTitle({
              eventType: record.eventType,
              title: record.title,
            });
            const message = formatNotificationMessage({
              eventType: record.eventType,
              actorName: record.actorName,
              memberName: record.memberName,
              title: record.title,
              message: record.message,
            });
            const actionLabel = getNotificationActionLabel(
              record.eventType,
              record.relatedModule,
            );

            return (
              <article
                key={record.id}
                className={cn(
                  "rounded-xl border bg-white px-4 py-4 transition-colors",
                  unread
                    ? "border-[#166534]/30 bg-[#f0fdf4]/40"
                    : "border-black/[0.08]",
                )}
              >
                <div className="flex items-start gap-3">
                  {unread ? (
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#166534]"
                      aria-label="Unread"
                    />
                  ) : (
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-transparent" />
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          {title}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {message}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatDisplayDate(record.createdAt)}
                      </time>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatNotificationEventLabel(record.eventType)}</span>
                      {record.readAt ? (
                        <span>· Read {formatDisplayDate(record.readAt)}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {record.actionUrl ? (
                        <Link
                          href={record.actionUrl}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex items-center gap-1.5",
                          )}
                          onClick={() => {
                            if (unread) {
                              handleMarkRead(record.id);
                            }
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          {actionLabel}
                        </Link>
                      ) : null}

                      {unread ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={readingId === record.id}
                          onClick={() => handleMarkRead(record.id)}
                        >
                          {readingId === record.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Marking as read...
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              Mark as read
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || isNavPending}
              onClick={() => updateFilters({ page: String(data.page - 1) })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isNavPending}
              onClick={() => updateFilters({ page: String(data.page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
