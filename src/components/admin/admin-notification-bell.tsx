"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "@/components/admin/use-unread-notification-count";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminNotificationBellProps {
  className?: string;
}

export function AdminNotificationBell({ className }: AdminNotificationBellProps) {
  const count = useUnreadNotificationCount();

  return (
    <Link
      href="/admin/notifications"
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "relative shrink-0 gap-2 max-sm:px-2",
        className,
      )}
    >
      <Bell className="size-4" />
      <span className="hidden sm:inline">Notifications</span>
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#166534] px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
