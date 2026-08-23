import { isMemberPortalRoute } from "@/lib/auth/routes";

/** Application surface that determines which notification stream to show. */
export type NotificationContext = "management" | "member";

export function isMemberNotificationContext(context: NotificationContext): boolean {
  return context === "member";
}

export function isManagementNotificationContext(
  context: NotificationContext,
): boolean {
  return context === "management";
}

/** Resolve notification context from a route pathname. */
export function resolveNotificationContextFromPath(
  pathname: string,
): NotificationContext {
  return isMemberPortalRoute(pathname) ? "member" : "management";
}
