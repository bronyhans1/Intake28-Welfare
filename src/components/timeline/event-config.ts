import type {
  TimelineEventDisplayConfig,
  TimelineIconKey,
  TimelineTone,
} from "@/components/timeline/types";

/**
 * Central display mapping for timeline event types.
 * Add future types here without changing the ActivityTimeline component.
 */
export const TIMELINE_EVENT_DISPLAY_CONFIG: Record<
  string,
  TimelineEventDisplayConfig
> = {
  // Membership Claims (Phase 4A / 4B)
  CLAIM_CREATED: { title: "Claim Created", tone: "neutral", icon: "fileText" },
  CLAIM_SUBMITTED: { title: "Claim Submitted", tone: "info", icon: "upload" },
  CLAIM_RETURNED_FOR_REVISION: {
    title: "Returned for Revision",
    tone: "warning",
    icon: "undo",
  },
  CLAIM_RESUBMITTED: {
    title: "Claim Resubmitted",
    tone: "success",
    icon: "refresh",
  },

  // Phase 5 executive review
  EXECUTIVE_ASSIGNED: { title: "Executive Assigned", tone: "info", icon: "user" },
  CLAIM_UNDER_REVIEW: { title: "Review Started", tone: "info", icon: "search" },
  EXECUTIVE_COMMENT_ADDED: {
    title: "Executive Comment Added",
    tone: "neutral",
    icon: "message",
  },
  CLAIM_RECOMMENDED: {
    title: "Claim Recommended",
    tone: "info",
    icon: "thumbsUp",
  },
  CLAIM_APPROVED: { title: "Claim Approved", tone: "success", icon: "check" },
  CLAIM_REJECTED: { title: "Claim Rejected", tone: "danger", icon: "x" },
  CLAIM_SENT_TO_FINANCE: {
    title: "Sent to Finance",
    tone: "info",
    icon: "banknote",
  },
  PAYMENT_PROCESSING_STARTED: {
    title: "Payment Processing Started",
    tone: "info",
    icon: "search",
  },
  CLAIM_PAID: { title: "Claim Paid", tone: "success", icon: "circleCheck" },

  // Aliases / reserved future types
  EXECUTIVE_COMMENT: {
    title: "Executive Comment",
    tone: "neutral",
    icon: "message",
  },
  UNDER_REVIEW: { title: "Under Review", tone: "info", icon: "search" },
  RECOMMENDED: { title: "Recommended", tone: "info", icon: "thumbsUp" },
  APPROVED: { title: "Approved", tone: "success", icon: "check" },
  REJECTED: { title: "Rejected", tone: "danger", icon: "x" },
  PAYMENT_APPROVED: {
    title: "Payment Approved",
    tone: "success",
    icon: "banknote",
  },
  PAYMENT_COMPLETED: {
    title: "Payment Completed",
    tone: "success",
    icon: "circleCheck",
  },
  CLOSED: { title: "Closed", tone: "neutral", icon: "lock" },
};

export const DEFAULT_TIMELINE_EVENT_DISPLAY: TimelineEventDisplayConfig = {
  tone: "neutral",
  icon: "circle",
};

export const TIMELINE_TONE_STYLES: Record<
  TimelineTone,
  { dot: string; icon: string; ring: string }
> = {
  neutral: {
    dot: "bg-slate-400",
    icon: "text-slate-600",
    ring: "ring-slate-200",
  },
  info: {
    dot: "bg-sky-500",
    icon: "text-sky-700",
    ring: "ring-sky-200",
  },
  warning: {
    dot: "bg-amber-500",
    icon: "text-amber-700",
    ring: "ring-amber-200",
  },
  success: {
    dot: "bg-emerald-500",
    icon: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  danger: {
    dot: "bg-rose-500",
    icon: "text-rose-700",
    ring: "ring-rose-200",
  },
};

export function resolveTimelineEventDisplay(
  eventType: string,
  config: Record<string, TimelineEventDisplayConfig> = TIMELINE_EVENT_DISPLAY_CONFIG,
): TimelineEventDisplayConfig {
  return config[eventType] ?? DEFAULT_TIMELINE_EVENT_DISPLAY;
}

export function resolveTimelineEventTitle(
  event: { type: string; title: string },
  config: Record<string, TimelineEventDisplayConfig> = TIMELINE_EVENT_DISPLAY_CONFIG,
): string {
  const mapped = resolveTimelineEventDisplay(event.type, config);
  return mapped.title?.trim() || event.title.trim() || event.type;
}

export type { TimelineIconKey };
