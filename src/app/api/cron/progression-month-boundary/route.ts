import { NextResponse } from "next/server";
import { runProgressionMonthBoundary } from "@/lib/progression/month-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Allow in development only when secret is unset so local dry-runs work.
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret === secret;
}

/**
 * Africa/Accra month-boundary progression sweep.
 * Intended for Vercel Cron (daily) — idempotent per Accra calendar month.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force =
    new URL(request.url).searchParams.get("force") === "1" &&
    process.env.NODE_ENV !== "production";

  try {
    const result = await runProgressionMonthBoundary({ force });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/progression-month-boundary]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Month-boundary run failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
