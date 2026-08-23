import { getMemberById } from "@/lib/members/repository";
import { hasOwnMemberPortalRole } from "@/lib/auth/member-portal-access";
import type { CurrentUser } from "@/types/auth";

/** Re-export for server modules that already import member context helpers. */
export { hasOwnMemberPortalRole };

/**
 * Resolve the authenticated user's own member id.
 * Returns actor.uid when a member record exists, otherwise null.
 */
export async function resolveOwnMemberId(
  actor: CurrentUser,
): Promise<string | null> {
  if (!hasOwnMemberPortalRole(actor.role)) {
    return null;
  }

  const member = await getMemberById(actor.uid);
  return member ? actor.uid : null;
}

/** Enforce that a requested member id belongs to the authenticated actor. */
export function assertOwnMemberScope(memberId: string, actor: CurrentUser): void {
  if (memberId !== actor.uid) {
    throw new Error("Forbidden: member scope violation.");
  }
}

/**
 * Require a linked member account for the authenticated actor.
 * Used before loading member-scoped welfare/history data.
 */
export async function requireOwnMemberId(actor: CurrentUser): Promise<string> {
  const memberId = await resolveOwnMemberId(actor);
  if (!memberId) {
    throw new Error("Member context required.");
  }
  return memberId;
}
