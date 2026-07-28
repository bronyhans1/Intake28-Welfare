export const AnnouncementAuditAction = {
  ANNOUNCEMENT_CREATED: "announcement_created",
  ANNOUNCEMENT_UPDATED: "announcement_updated",
  ANNOUNCEMENT_PUBLISHED: "announcement_published",
  ANNOUNCEMENT_ARCHIVED: "announcement_archived",
} as const;

export type AnnouncementAuditAction =
  (typeof AnnouncementAuditAction)[keyof typeof AnnouncementAuditAction];
