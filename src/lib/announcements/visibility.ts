import {
  AnnouncementAudience,
  AnnouncementStatus,
  UserRole,
  UserStatus,
} from "@/types/enums";
import type { SerializedAnnouncement } from "@/types/announcement";

export interface AnnouncementViewerContext {
  userId: string;
  role: UserRole;
  status: UserStatus;
  isDefaulter: boolean;
}

export function isAnnouncementPublishedAndNotExpired(
  announcement: Pick<SerializedAnnouncement, "status" | "expiresAt">,
  now: Date = new Date(),
): boolean {
  if (announcement.status !== AnnouncementStatus.PUBLISHED) {
    return false;
  }

  if (!announcement.expiresAt) {
    return true;
  }

  const expiresAt = new Date(announcement.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

export function isAnnouncementVisibleToViewer(
  announcement: Pick<SerializedAnnouncement, "audience" | "status" | "expiresAt">,
  viewer: AnnouncementViewerContext,
  now: Date = new Date(),
): boolean {
  if (!isAnnouncementPublishedAndNotExpired(announcement, now)) {
    return false;
  }

  switch (announcement.audience) {
    case AnnouncementAudience.ALL_MEMBERS:
      return true;
    case AnnouncementAudience.ACTIVE_MEMBERS:
      return viewer.status === UserStatus.ACTIVE;
    case AnnouncementAudience.DEFAULTERS:
      return viewer.isDefaulter;
    case AnnouncementAudience.TREASURERS:
      return viewer.role === UserRole.TREASURER;
    case AnnouncementAudience.ADMINS:
      return viewer.role === UserRole.ADMIN;
    default:
      return false;
  }
}

export function filterVisibleAnnouncements(
  announcements: SerializedAnnouncement[],
  viewer: AnnouncementViewerContext,
  now: Date = new Date(),
): SerializedAnnouncement[] {
  return announcements.filter((announcement) =>
    isAnnouncementVisibleToViewer(announcement, viewer, now),
  );
}
