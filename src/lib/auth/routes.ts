import { UserRole } from "@/types/enums";

export const PUBLIC_ROUTES = [
  "/login",
  "/activate-account",
  "/forgot-password",
] as const;

export const MEMBER_ROUTES = [
  "/dashboard",
  "/portal/profile",
  "/portal/profile/edit",
  "/portal/welfare-support",
  "/portal/claims",
  "/portal/contributions",
  "/portal/announcements",
  "/portal/notifications",
  "/profile",
  "/contributions",
  "/payments",
  "/receipts",
  "/announcements",
] as const;

export function isMemberPortalRoute(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/portal/") ||
    MEMBER_ROUTES.includes(pathname as (typeof MEMBER_ROUTES)[number])
  );
}

export const ADMIN_ROUTES = [
  "/admin",
  "/admin/dashboard",
  "/admin/members",
  "/admin/members/pending",
  "/admin/membership-requests",
  "/admin/welfare-support",
  "/admin/claims/types",
  "/admin/claims/eligibility",
  "/admin/claims/submitted",
  "/admin/claims/finance",
  "/admin/constitutions",
  "/admin/audit-logs",
  "/admin/finance",
  "/admin/finance/defaulters",
  "/admin/finance/reconciliation",
  "/admin/contributions",
  "/admin/payments",
  "/admin/reports",
  "/admin/announcements",
  "/admin/notifications",
  "/admin/settings",
] as const;

export const ADMIN_ONLY_ROUTES = [
  "/admin/members",
  "/admin/contributions",
  "/admin/settings",
  "/admin/claims/types",
  "/admin/claims/eligibility",
  "/admin/constitutions",
] as const;

export const TREASURER_ROUTES = [
  "/admin",
  "/admin/dashboard",
  "/admin/members",
  "/admin/members/pending",
  "/admin/membership-requests",
  "/admin/welfare-support",
  "/admin/claims/submitted",
  "/admin/claims/finance",
  "/admin/audit-logs",
  "/admin/finance",
  "/admin/finance/defaulters",
  "/admin/finance/reconciliation",
  "/admin/contributions",
  "/admin/payments",
  "/admin/reports",
  "/admin/announcements",
  "/admin/notifications",
] as const;

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }

  if (role === UserRole.ADMIN) {
    return (
      isMemberPortalRoute(pathname) ||
      ADMIN_ROUTES.includes(pathname as (typeof ADMIN_ROUTES)[number]) ||
      pathname.startsWith("/admin/")
    );
  }

  if (role === UserRole.TREASURER) {
    return (
      isMemberPortalRoute(pathname) ||
      TREASURER_ROUTES.includes(pathname as (typeof TREASURER_ROUTES)[number]) ||
      pathname.startsWith("/admin/members/") ||
      pathname.startsWith("/admin/membership-requests") ||
      pathname.startsWith("/admin/welfare-support/") ||
      pathname.startsWith("/admin/contributions/") ||
      pathname.startsWith("/admin/finance/") ||
      pathname.startsWith("/admin/announcements/") ||
      pathname.startsWith("/admin/claims/submitted") ||
      pathname.startsWith("/admin/claims/finance") ||
      pathname.startsWith("/admin/notifications")
    );
  }

  if (role === UserRole.MEMBER) {
    return isMemberPortalRoute(pathname);
  }

  return false;
}
