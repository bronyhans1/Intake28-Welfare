/**
 * Generic activity timeline types — module-agnostic.
 * Claims, payments, and other domains can supply compatible events.
 */

export type TimelineTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger";

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  performedByName?: string | null;
  performedByRole?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TimelineEventDisplayConfig {
  /** Optional display title override (falls back to event.title) */
  title?: string;
  tone: TimelineTone;
  /** Lucide icon name key resolved by the timeline UI */
  icon: TimelineIconKey;
}

export type TimelineIconKey =
  | "fileText"
  | "upload"
  | "undo"
  | "refresh"
  | "user"
  | "message"
  | "search"
  | "thumbsUp"
  | "check"
  | "x"
  | "banknote"
  | "circleCheck"
  | "lock"
  | "circle";
