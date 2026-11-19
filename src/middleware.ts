import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveMiddlewareAuth } from "@/lib/auth/middleware-routing";
import { AUTH_SESSION_COOKIE } from "@/types/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_SESSION_COOKIE)?.value);

  const decision = resolveMiddlewareAuth(
    pathname,
    hasSession,
    request.nextUrl.origin,
  );

  if (decision.action === "allow") {
    return NextResponse.next();
  }

  return NextResponse.redirect(decision.url);
}

export const config = {
  matcher: [
    "/login",
    "/activate-account/:path*",
    "/forgot-password/:path*",
    "/dashboard/:path*",
    "/portal/:path*",
    "/profile/:path*",
    "/contributions/:path*",
    "/payments/:path*",
    "/receipts/:path*",
    "/announcements/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
