"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, Check, CheckCheck, Search } from "lucide-react";
import {
  archiveNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/toast-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatNotificationEventLabel,
  formatNotificationMessage,
  formatNotificationTitle,
} from "@/lib/notifications/labels";
import type { NotificationListResult } from "@/lib/notifications/repository";
import { NotificationEventStatus } from "@/lib/notifications/types";
import { formatDisplayDate } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";

interface NotificationsTableProps {
  data: NotificationListResult;
  canManage: boolean;
}

const FILTER_ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

function buildQuery(
  searchParams: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }

  if ("search" in updates || "status" in updates) {
    params.set("page", "1");
  }

  return params.toString();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    [NotificationEventStatus.UNREAD]: "bg-sky-50 text-sky-800",
    [NotificationEventStatus.READ]: "bg-muted text-muted-foreground",
    [NotificationEventStatus.ARCHIVED]: "bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function NotificationsTable({ data, canManage }: NotificationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<{
    type: "read" | "archive" | "read-all";
    id?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const urlSearch = searchParams.get("search") ?? "";
  const urlStatus = searchParams.get("status") ?? FILTER_ALL;

  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState(urlStatus);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);
  useEffect(() => { setStatus(urlStatus); }, [urlStatus]);

  function updateFilters(updates: Record<string, string | undefined>) {
    startTransition(() => {
      router.push(`/admin/notifications?${buildQuery(searchParams, updates)}`);
    });
  }

  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.push(
          `/admin/notifications?${buildQuery(searchParamsRef.current, {
            search: search || undefined,
          })}`,
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, urlSearch, router]);

  function handleMarkRead(notificationId: string) {
    setActionError(null);
    setPendingAction({ type: "read", id: notificationId });
    startTransition(async () => {
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
    startTransition(async () => {
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

  function handleArchive(notificationId: string) {
    setActionError(null);
    setPendingAction({ type: "archive", id: notificationId });
    startTransition(async () => {
      try {
        const result = await archiveNotificationAction(notificationId);
        if (result.error) {
          setActionError(result.error);
          return;
        }
        showSuccess("Notification archived.");
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="notification-search">Search</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="notification-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Member, service number, actor…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => {
                const next = value ?? FILTER_ALL;
                setStatus(next);
                updateFilters({ status: next === FILTER_ALL ? undefined : next });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>All</SelectItem>
                <SelectItem value={NotificationEventStatus.UNREAD}>Unread</SelectItem>
                <SelectItem value={NotificationEventStatus.READ}>Read</SelectItem>
                <SelectItem value={NotificationEventStatus.ARCHIVED}>Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {canManage && data.unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={pendingAction?.type === "read-all"}
            className="border-sky-200 text-sky-700 hover:bg-sky-50"
          >
            <CheckCheck className="size-4" />
            {pendingAction?.type === "read-all"
              ? "Marking all..."
              : "Mark all as read"}
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="rounded-xl border border-black/[0.08] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Notification</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No notifications found.
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="max-w-xs">
                    <p className="text-sm font-medium">
                      {formatNotificationTitle({
                        eventType: record.eventType,
                        title: record.title,
                      })}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {formatNotificationMessage({
                        eventType: record.eventType,
                        actorName: record.actorName,
                        memberName: record.memberName,
                        title: record.title,
                        message: record.message,
                      })}
                    </p>
                    {record.relatedModule ? (
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {record.relatedModule}
                        {record.audience ? ` · ${record.audience}` : ""}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{record.memberName}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.serviceNumber}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatNotificationEventLabel(record.eventType)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={record.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDisplayDate(record.createdAt)}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {record.status === NotificationEventStatus.UNREAD ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkRead(record.id)}
                            disabled={
                              pendingAction?.type === "read" &&
                              pendingAction.id === record.id
                            }
                            className="text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                          >
                            <Check className="size-4" />
                            {pendingAction?.type === "read" &&
                            pendingAction.id === record.id
                              ? "Reading..."
                              : "Read"}
                          </Button>
                        ) : null}
                        {record.status !== NotificationEventStatus.ARCHIVED ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(record.id)}
                            disabled={
                              pendingAction?.type === "archive" &&
                              pendingAction.id === record.id
                            }
                            className="text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          >
                            <Archive className="size-4" />
                            {pendingAction?.type === "archive" &&
                            pendingAction.id === record.id
                              ? "Archiving..."
                              : "Archive"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
              disabled={data.page <= 1 || isPending}
              onClick={() =>
                updateFilters({ page: String(data.page - 1) })
              }
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isPending}
              onClick={() =>
                updateFilters({ page: String(data.page + 1) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
