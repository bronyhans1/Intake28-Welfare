import { UserRole } from "@/types/enums";

export const Permission = {
  // Member management
  ADD_MEMBER: "add_member",
  IMPORT_MEMBERS: "import_members",
  EDIT_MEMBER: "edit_member",
  DEACTIVATE_MEMBER: "deactivate_member",
  ASSIGN_TREASURER: "assign_treasurer",
  ASSIGN_ADMIN: "assign_admin",
  VIEW_MEMBERS: "view_members",
  VIEW_MEMBERSHIP_REQUESTS: "view_membership_requests",
  REVIEW_MEMBERSHIP_REQUESTS: "review_membership_requests",

  // Contributions
  CREATE_CONTRIBUTIONS: "create_contributions",
  MANAGE_CONTRIBUTIONS: "manage_contributions",
  VIEW_CONTRIBUTIONS: "view_contributions",

  // Payments & collections
  VIEW_PAYMENTS: "view_payments",
  VIEW_COLLECTIONS: "view_collections",
  MAKE_PAYMENTS: "make_payments",

  // Defaulters & reports
  VIEW_DEFAULTERS: "view_defaulters",
  VIEW_REPORTS: "view_reports",

  // Announcements
  MANAGE_ANNOUNCEMENTS: "manage_announcements",
  VIEW_ANNOUNCEMENTS: "view_announcements",

  // Receipts & profile
  VIEW_RECEIPTS: "view_receipts",
  DOWNLOAD_RECEIPTS: "download_receipts",
  VIEW_RECONCILIATION: "view_reconciliation",
  UPDATE_PROFILE: "update_profile",
  UPLOAD_PROFILE_PHOTO: "upload_profile_photo",

  // Audit
  VIEW_AUDIT_LOGS: "view_audit_logs",

  // Notifications
  VIEW_NOTIFICATIONS: "view_notifications",
  VIEW_OWN_NOTIFICATIONS: "view_own_notifications",
  MANAGE_NOTIFICATIONS: "manage_notifications",

  // Welfare support
  CREATE_WELFARE_SUPPORT: "create_welfare_support",
  EDIT_WELFARE_SUPPORT: "edit_welfare_support",
  VIEW_WELFARE_SUPPORT: "view_welfare_support",
  VIEW_OWN_WELFARE_SUPPORT: "view_own_welfare_support",

  // Membership claims
  CREATE_CLAIM: "create_claim",
  VIEW_OWN_CLAIMS: "view_own_claims",
  VIEW_ALL_CLAIMS: "view_all_claims",
  REVIEW_CLAIMS: "review_claims",
  ASSIGN_CLAIMS: "assign_claims",
  PROCESS_CLAIM_PAYMENTS: "process_claim_payments",
  MANAGE_CLAIM_TYPES: "manage_claim_types",
  VIEW_CONSTITUTIONS: "view_constitutions",
  MANAGE_CONSTITUTIONS: "manage_constitutions",

  // System
  MANAGE_SETTINGS: "manage_settings",
  VIEW_DASHBOARD: "view_dashboard",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/** Baseline member portal capabilities shared by all welfare members. */
export const MEMBER_PERMISSIONS = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_CONTRIBUTIONS,
  Permission.MAKE_PAYMENTS,
  Permission.VIEW_RECEIPTS,
  Permission.DOWNLOAD_RECEIPTS,
  Permission.VIEW_ANNOUNCEMENTS,
  Permission.UPDATE_PROFILE,
  Permission.UPLOAD_PROFILE_PHOTO,
  Permission.VIEW_OWN_WELFARE_SUPPORT,
  Permission.CREATE_CLAIM,
  Permission.VIEW_OWN_CLAIMS,
  Permission.VIEW_OWN_NOTIFICATIONS,
] as const satisfies readonly Permission[];

function withMemberPermissions(
  permissions: readonly Permission[],
): readonly Permission[] {
  return [...new Set<Permission>([...MEMBER_PERMISSIONS, ...permissions])];
}

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMIN]: withMemberPermissions([
    Permission.ADD_MEMBER,
    Permission.IMPORT_MEMBERS,
    Permission.EDIT_MEMBER,
    Permission.DEACTIVATE_MEMBER,
    Permission.ASSIGN_TREASURER,
    Permission.ASSIGN_ADMIN,
    Permission.VIEW_MEMBERS,
    Permission.VIEW_MEMBERSHIP_REQUESTS,
    Permission.REVIEW_MEMBERSHIP_REQUESTS,
    Permission.CREATE_CONTRIBUTIONS,
    Permission.MANAGE_CONTRIBUTIONS,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_COLLECTIONS,
    Permission.VIEW_DEFAULTERS,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_ANNOUNCEMENTS,
    Permission.MANAGE_SETTINGS,
    Permission.CREATE_WELFARE_SUPPORT,
    Permission.EDIT_WELFARE_SUPPORT,
    Permission.VIEW_WELFARE_SUPPORT,
    Permission.VIEW_ALL_CLAIMS,
    Permission.REVIEW_CLAIMS,
    Permission.ASSIGN_CLAIMS,
    Permission.PROCESS_CLAIM_PAYMENTS,
    Permission.MANAGE_CLAIM_TYPES,
    Permission.VIEW_CONSTITUTIONS,
    Permission.MANAGE_CONSTITUTIONS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_NOTIFICATIONS,
    Permission.MANAGE_NOTIFICATIONS,
    Permission.VIEW_RECONCILIATION,
  ]),
  [UserRole.TREASURER]: withMemberPermissions([
    Permission.VIEW_MEMBERS,
    Permission.VIEW_MEMBERSHIP_REQUESTS,
    Permission.REVIEW_MEMBERSHIP_REQUESTS,
    Permission.CREATE_CONTRIBUTIONS,
    Permission.MANAGE_CONTRIBUTIONS,
    Permission.VIEW_PAYMENTS,
    Permission.VIEW_COLLECTIONS,
    Permission.VIEW_DEFAULTERS,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_ANNOUNCEMENTS,
    Permission.CREATE_WELFARE_SUPPORT,
    Permission.EDIT_WELFARE_SUPPORT,
    Permission.VIEW_WELFARE_SUPPORT,
    Permission.VIEW_ALL_CLAIMS,
    Permission.REVIEW_CLAIMS,
    Permission.ASSIGN_CLAIMS,
    Permission.PROCESS_CLAIM_PAYMENTS,
    Permission.VIEW_CONSTITUTIONS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.VIEW_NOTIFICATIONS,
    Permission.MANAGE_NOTIFICATIONS,
    Permission.VIEW_RECONCILIATION,
  ]),
  [UserRole.MEMBER]: [...MEMBER_PERMISSIONS],
} as const;

export function hasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}
