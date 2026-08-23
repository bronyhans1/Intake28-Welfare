import { getLoginRedirectPath, canAccessAdminRoute } from "@/lib/auth/login";
import { UserRole } from "@/types/enums";

/** Roles that may access the member portal when linked to a member account. */
export function hasOwnMemberPortalRole(role: UserRole): boolean {
  return (
    role === UserRole.MEMBER ||
    role === UserRole.ADMIN ||
    role === UserRole.TREASURER
  );
}

/**
 * Route-level eligibility for the member portal.
 * Executives may enter member portal routes; server guards verify linked member account.
 */
export function canAccessMemberPortal(role: UserRole): boolean {
  return hasOwnMemberPortalRole(role);
}

/**
 * Resolve where users should land when they cannot use a member portal route.
 */
export function getMemberPortalAccessRedirect(
  role: UserRole,
  pathname: string,
): string {
  if (canAccessMemberPortal(role)) {
    return pathname;
  }

  if (!canAccessAdminRoute(role)) {
    return "/login";
  }

  return getLoginRedirectPath(role);
}

/**
 * Redirect target for authenticated executives without a linked member account.
 */
export function getExecutiveWithoutMemberRedirect(role: UserRole): string {
  return getLoginRedirectPath(role);
}
