"use client";

import { useEffect, useState } from "react";
import { fetchUnreadNotificationCountAction } from "@/actions/notifications";

export function useUnreadNotificationCount(pollIntervalMs = 60_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      const result = await fetchUnreadNotificationCountAction();
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
  }, [pollIntervalMs]);

  return count;
}
