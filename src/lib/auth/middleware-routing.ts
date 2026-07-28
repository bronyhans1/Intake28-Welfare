import { PUBLIC_ROUTES } from "./routes";

/**
 * Routes that do not require an authenticated session.
 * Includes auth flows and activation sub-routes.
 */
export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }

  if (pathname.startsWith("/activate-account")) {
    return true;
  }

  if (pathname.startsWith("/forgot-password")) {
    return true;
  }

  return false;
}

/**
 * Returns a safe post-login redirect path, or null when redirecting to login
 * would cause a loop or target another public page.
 */
export function getSafeNextPath(pathname: string): string | null {
  if (!pathname || pathname === "/login") {
    return null;
  }

  if (isPublicRoute(pathname)) {
    return null;
  }

  return pathname;
}

export type MiddlewareAuthDecision =
  | { action: "allow" }
  | { action: "redirect"; url: string };

/**
 * Pure routing decision for middleware — session presence only.
 * Role checks remain in server components / RequireAdmin (Phase 5B).
 */
export function resolveMiddlewareAuth(
  pathname: string,
  hasSession: boolean,
  origin: string,
): MiddlewareAuthDecision {
  if (isPublicRoute(pathname)) {
    return { action: "allow" };
  }

  if (hasSession) {
    return { action: "allow" };
  }

  // Safeguard: never redirect when already on login
  if (pathname === "/login") {
    return { action: "allow" };
  }

  const loginUrl = new URL("/login", origin);
  const nextPath = getSafeNextPath(pathname);

  if (nextPath) {
    loginUrl.searchParams.set("next", nextPath);
  }

  return { action: "redirect", url: loginUrl.toString() };
}
