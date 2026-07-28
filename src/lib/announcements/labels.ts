import {
  ANNOUNCEMENT_AUDIENCE_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  AnnouncementAudience,
  AnnouncementStatus,
} from "@/types/enums";

export function isAnnouncementAudience(value: string): value is AnnouncementAudience {
  return Object.values(AnnouncementAudience).includes(value as AnnouncementAudience);
}

export function isAnnouncementStatus(value: string): value is AnnouncementStatus {
  return Object.values(AnnouncementStatus).includes(value as AnnouncementStatus);
}

export function formatAnnouncementAudienceLabel(
  value: string | AnnouncementAudience | null | undefined,
): string {
  if (!value) return "—";
  if (isAnnouncementAudience(value)) {
    return ANNOUNCEMENT_AUDIENCE_LABELS[value];
  }
  return value;
}

export function formatAnnouncementStatusLabel(
  value: string | AnnouncementStatus | null | undefined,
): string {
  if (!value) return "—";
  if (isAnnouncementStatus(value)) {
    return ANNOUNCEMENT_STATUS_LABELS[value];
  }
  return value;
}

export function formatAnnouncementAudienceFilterLabel(
  value: string,
  allLabel = "All Audiences",
): string {
  if (!value || value === "all") return allLabel;
  return formatAnnouncementAudienceLabel(value);
}

export function formatAnnouncementStatusFilterLabel(
  value: string,
  allLabel = "All Statuses",
): string {
  if (!value || value === "all") return allLabel;
  return formatAnnouncementStatusLabel(value);
}
