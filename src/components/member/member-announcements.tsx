import Link from "next/link";
import { Megaphone } from "lucide-react";
import {
  AnnouncementAudienceBadge,
  AnnouncementStatusBadge,
} from "@/components/admin/announcements-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedAnnouncement } from "@/types/announcement";

interface MemberAnnouncementsListProps {
  announcements: SerializedAnnouncement[];
}

export function MemberAnnouncementsList({ announcements }: MemberAnnouncementsListProps) {
  if (announcements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No announcements available right now.</p>
    );
  }

  return (
    <div className="space-y-4">
      {announcements.map((announcement) => (
        <Card
          key={announcement.id}
          className="rounded-2xl border border-black/[0.08] bg-white shadow-sm"
        >
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AnnouncementAudienceBadge audience={announcement.audience} />
            </div>
            <CardTitle className="text-lg">{announcement.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Published {formatDisplayDate(announcement.publishedAt ?? announcement.createdAt)}
            </p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {announcement.message}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface AnnouncementsSummaryCardProps {
  count: number;
}

export function AnnouncementsSummaryCard({ count }: AnnouncementsSummaryCardProps) {
  return (
    <Link href="/portal/announcements" className="block">
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm transition-all hover:border-black/[0.14] hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-4 pt-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Announcements</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{count}</p>
            <p className="text-xs text-muted-foreground">
              {count === 1
                ? "Announcement available for you"
                : "Announcements available for you"}
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
            <Megaphone className="size-5 text-violet-700" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface LatestAnnouncementCardProps {
  announcement: SerializedAnnouncement | null;
}

export function LatestAnnouncementCard({ announcement }: LatestAnnouncementCardProps) {
  if (!announcement) {
    return (
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Latest Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No announcements available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle>Latest Announcement</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatDisplayDate(announcement.publishedAt ?? announcement.createdAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium text-foreground">{announcement.title}</p>
        <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {announcement.message}
        </p>
      </CardContent>
    </Card>
  );
}

interface RecentAnnouncementsProps {
  announcements: SerializedAnnouncement[];
}

export function RecentAnnouncements({ announcements }: RecentAnnouncementsProps) {
  if (announcements.length === 0) {
    return <p className="text-sm text-muted-foreground">No published announcements yet.</p>;
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className="rounded-xl border border-black/[0.06] px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{announcement.title}</p>
            <AnnouncementStatusBadge status={announcement.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {announcement.createdByName} ·{" "}
            {formatDisplayDate(announcement.publishedAt ?? announcement.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
