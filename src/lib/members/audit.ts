export const MemberAuditAction = {
  MEMBER_CREATED: "member_created",
  MEMBER_UPDATED: "member_updated",
  ACTIVATION_RESET: "activation_reset",
  STATUS_CHANGED: "status_changed",
  ROLE_CHANGED: "role_changed",
  EMAIL_ADDED: "email_added",
  EMAIL_UPDATED: "email_updated",
  EMAIL_REMOVED: "email_removed",
  PROFILE_PHOTO_UPLOADED: "profile_photo_uploaded",
  PROFILE_PHOTO_UPDATED: "profile_photo_updated",
  PROFILE_PHOTO_REMOVED: "profile_photo_removed",
  PARENT_INFORMATION_SAVED: "parent_information_saved",
  PARENT_INFORMATION_OVERRIDE: "parent_information_override",
} as const;

export type MemberAuditAction =
  (typeof MemberAuditAction)[keyof typeof MemberAuditAction];

export function resolveEmailAuditAction(
  before: string | null,
  after: string | null,
): MemberAuditAction | null {
  if (before === after) {
    return null;
  }

  if (!before && after) {
    return MemberAuditAction.EMAIL_ADDED;
  }

  if (before && !after) {
    return MemberAuditAction.EMAIL_REMOVED;
  }

  return MemberAuditAction.EMAIL_UPDATED;
}

export function resolveProfilePhotoAuditAction(
  before: string | null,
  after: string | null,
): MemberAuditAction | null {
  if (before === after) {
    return null;
  }

  if (!before && after) {
    return MemberAuditAction.PROFILE_PHOTO_UPLOADED;
  }

  if (before && !after) {
    return MemberAuditAction.PROFILE_PHOTO_REMOVED;
  }

  return MemberAuditAction.PROFILE_PHOTO_UPDATED;
}
