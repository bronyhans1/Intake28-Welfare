import { redirect } from "next/navigation";
import {
  canAccessMemberPortal,
  getExecutiveWithoutMemberRedirect,
  getMemberPortalAccessRedirect,
} from "@/lib/auth/member-portal-access";
import { resolveOwnMemberId } from "@/lib/members/member-context";
import type { CurrentUser } from "@/types/auth";

/**
 * Server-side guard for member portal pages.
 * Allows members and linked executive accounts; redirects others.
 */
export async function requireOwnMemberPortalAccess(
  actor: CurrentUser,
  pathname: string,
): Promise<string> {
  if (!canAccessMemberPortal(actor.role)) {
    redirect(getMemberPortalAccessRedirect(actor.role, pathname));
  }

  const memberId = await resolveOwnMemberId(actor);
  if (!memberId) {
    redirect(getExecutiveWithoutMemberRedirect(actor.role));
  }

  return memberId;
}
