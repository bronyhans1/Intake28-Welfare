"use client";

import { useEffect, useState } from "react";
import { fetchUnreadNotificationCountAction } from "@/actions/notifications";
import type { NotificationContext } from "@/lib/notifications/context";

export function useUnreadNotificationCount(
  pollIntervalMs = 60_000,
  context: NotificationContext = "management",
): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      const result = await fetchUnreadNotificationCountAction(context);
      if (active && !result.error) {
        setCount(result.count);
      }
    }

    void loadCount();
    const interval = window.setInterval(() => {
      void loadCount();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pollIntervalMs, context]);

  return count;
}
