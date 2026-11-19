import {
  formatAnnouncementAudienceLabel,
  formatAnnouncementStatusLabel,
} from "@/lib/announcements/labels";
import {
  ANNOUNCEMENT_STATUS_LABELS,
  AnnouncementAudience,
  AnnouncementStatus,
} from "@/types/enums";
import { cn } from "@/lib/utils";

interface BadgeProps {
  className?: string;
}

export function AnnouncementAudienceBadge({
  audience,
  className,
}: BadgeProps & { audience: AnnouncementAudience | string }) {
  const label = formatAnnouncementAudienceLabel(audience);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium text-violet-700",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AnnouncementStatusBadge({
  status,
  className,
}: BadgeProps & { status: AnnouncementStatus | string }) {
  const styles: Record<string, string> = {
    [AnnouncementStatus.DRAFT]: "text-slate-700",
    [AnnouncementStatus.PUBLISHED]: "text-[#166534]",
    [AnnouncementStatus.ARCHIVED]: "text-amber-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium",
        styles[status] ?? "text-muted-foreground",
        className,
      )}
    >
      {formatAnnouncementStatusLabel(status)}
    </span>
  );
}

export { ANNOUNCEMENT_STATUS_LABELS };
