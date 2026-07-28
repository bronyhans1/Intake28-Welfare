"use client";

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Check,
  Circle,
  CircleCheck,
  FileText,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  ThumbsUp,
  Undo2,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  resolveTimelineEventDisplay,
  resolveTimelineEventTitle,
  TIMELINE_EVENT_DISPLAY_CONFIG,
  TIMELINE_TONE_STYLES,
} from "@/components/timeline/event-config";
import type {
  TimelineEvent,
  TimelineEventDisplayConfig,
  TimelineIconKey,
} from "@/components/timeline/types";
import {
  formatTimelineDateTime,
  formatTimelineMetadataEntries,
  formatTimelineRole,
  sortTimelineEvents,
} from "@/components/timeline/timeline-utils";
import { cn } from "@/lib/utils";

const TIMELINE_ICONS: Record<TimelineIconKey, LucideIcon> = {
  fileText: FileText,
  upload: Upload,
  undo: Undo2,
  refresh: RefreshCw,
  user: User,
  message: MessageSquare,
  search: Search,
  thumbsUp: ThumbsUp,
  check: Check,
  x: X,
  banknote: Banknote,
  circleCheck: CircleCheck,
  lock: Lock,
  circle: Circle,
};

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  /** Optional override / extension of event display mapping */
  eventConfig?: Record<string, TimelineEventDisplayConfig>;
  emptyMessage?: string;
  className?: string;
  /** When true, shows a compact metadata dump for selected simple values */
  showMetadata?: boolean;
}

/**
 * Reusable activity timeline. Domain-agnostic — renders whatever events it receives.
 */
export function ActivityTimeline({
  events,
  eventConfig,
  emptyMessage = "No activity has been recorded.",
  className,
  showMetadata = false,
}: ActivityTimelineProps) {
  const config = { ...TIMELINE_EVENT_DISPLAY_CONFIG, ...eventConfig };
  const ordered = sortTimelineEvents(events);

  if (ordered.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          "rounded-xl border border-dashed border-black/[0.1] bg-slate-50/80 px-4 py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol
      className={cn("relative space-y-0", className)}
      aria-label="Activity timeline"
    >
      {ordered.map((event, index) => {
        const display = resolveTimelineEventDisplay(event.type, config);
        const tone = TIMELINE_TONE_STYLES[display.tone];
        const Icon = TIMELINE_ICONS[display.icon] ?? Circle;
        const title = resolveTimelineEventTitle(event, config);
        const roleLabel = formatTimelineRole(event.performedByRole);
        const isLast = index === ordered.length - 1;
        const metadataEntries = showMetadata
          ? formatTimelineMetadataEntries(event.metadata)
          : [];

        return (
          <li key={event.id} className="relative flex gap-3 pb-8 last:pb-0 sm:gap-4">
            {!isLast ? (
              <span
                aria-hidden
                className="absolute left-[15px] top-8 bottom-0 w-px bg-black/[0.08] sm:left-[17px]"
              />
            ) : null}

            <div
              className={cn(
                "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 sm:h-9 sm:w-9",
                tone.ring,
              )}
            >
              <span className="sr-only">{display.tone} event</span>
              <Icon
                className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", tone.icon)}
                aria-hidden
              />
              <span
                aria-hidden
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full",
                  tone.dot,
                )}
              />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-sm font-semibold text-foreground sm:text-[0.95rem]">
                {title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                <time dateTime={event.createdAt}>
                  {formatTimelineDateTime(event.createdAt)}
                </time>
              </p>

              {event.performedByName ? (
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  by {event.performedByName}
                  {roleLabel ? (
                    <span className="text-muted-foreground/80">
                      {" "}
                      · {roleLabel}
                    </span>
                  ) : null}
                </p>
              ) : null}

              {event.reason?.trim() ? (
                <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
                    Reason
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{event.reason}</p>
                </div>
              ) : null}

              {metadataEntries.length > 0 ? (
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:text-sm">
                  {metadataEntries.map((entry) => (
                    <div key={entry.label} className="flex flex-wrap gap-1">
                      <dt className="font-medium text-foreground/70">
                        {entry.label}:
                      </dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
