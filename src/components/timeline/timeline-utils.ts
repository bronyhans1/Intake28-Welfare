import type { TimelineEvent } from "@/components/timeline/types";

/**
 * Sort timeline events oldest → newest for vertical display.
 * Pure helper — safe for unit tests and any consumer module.
 */
export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

export function formatTimelineDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Accra",
  }).format(date);

  return `${day} • ${time}`;
}

export function formatTimelineRole(role: string | null | undefined): string | null {
  if (!role?.trim()) return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin") return "Administrator";
  if (normalized === "treasurer") return "Treasurer";
  if (normalized === "member") return "Member";
  return role.trim();
}

/** Human-readable metadata entries (skips empty / nested objects). */
export function formatTimelineMetadataEntries(
  metadata: Record<string, unknown> | null | undefined,
): Array<{ label: string; value: string }> {
  if (!metadata) return [];

  return Object.entries(metadata)
    .filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (typeof value === "number" || typeof value === "boolean") return true;
      return false;
    })
    .map(([key, value]) => ({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/^\w/, (char) => char.toUpperCase())
        .trim(),
      value: String(value),
    }));
}
