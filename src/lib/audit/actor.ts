import { findUserById } from "@/lib/activation/repository";
import type { CurrentUser } from "@/types/auth";

export interface AuditActorFields {
  performedBy: string;
  performedByRole: string;
  actorId: string;
  actorName: string;
  role: string;
}

export interface AuditActorLog {
  actorName?: string | null;
  actorId?: string | null;
  performedBy?: string | null;
}

export interface ResolveAuditActorOptions {
  /** Current signed-in user — used when legacy logs lack actorName */
  sessionUserFullName?: string | null;
}

export function buildAuditActor(
  actor: Pick<CurrentUser, "uid" | "fullName" | "role">,
): AuditActorFields {
  return {
    performedBy: actor.uid,
    performedByRole: actor.role,
    actorId: actor.uid,
    actorName: actor.fullName,
    role: actor.role,
  };
}

/**
 * Resolves a display name for audit activity.
 * Fallback chain: actorName → UID lookup → session user → "System"
 */
export async function resolveAuditActorDisplayName(
  log: AuditActorLog,
  options: ResolveAuditActorOptions = {},
): Promise<string> {
  const actorName = log.actorName?.trim();
  if (actorName) {
    return actorName;
  }

  const actorId = log.actorId?.trim() || log.performedBy?.trim();
  if (actorId) {
    const user = await findUserById(actorId);
    const resolvedName = user?.fullName?.trim();
    if (resolvedName) {
      return resolvedName;
    }
  }

  const sessionName = options.sessionUserFullName?.trim();
  if (sessionName) {
    return sessionName;
  }

  return "System";
}

/** @deprecated Use resolveAuditActorDisplayName for server-side resolution */
export function resolveAuditActorName(log: AuditActorLog): string {
  const actorName = log.actorName?.trim();
  if (actorName) {
    return actorName;
  }

  return "System";
}
