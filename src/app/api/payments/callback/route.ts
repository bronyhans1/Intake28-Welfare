import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  recordCallbackOutcomeAudit,
  settlePaymentIngest,
} from "@/lib/payments/paystack-ingest";

export const dynamic = "force-dynamic";

/**
 * Browser return / Hubtel server notify landing.
 *
 * Query/body fields are untrusted. Settlement always re-verifies with the
 * payment provider status API (Hubtel or Paystack) via settlePaymentIngest.
 * A successful browser redirect alone never marks a payment as paid.
 *
 * Abuse protection note (Phase 4A): this project has no durable shared store
 * (Redis/Upstash/etc.) for cross-instance rate limiting. An in-memory limiter
 * would not protect multi-instance production and is intentionally not added.
 * Mitigations in place: settlement requires an existing payment reference,
 * Hubtel/Paystack status re-verification, and permanent rejects for unknown
 * references. Platform/WAF rate limits remain an ops concern for production.
 */

function buildPaymentsRedirect(path: string): string {
  const base = env.client().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

function extractReferenceFromSearchParams(url: URL): string {
  return (
    url.searchParams.get("reference")?.trim() ||
    url.searchParams.get("clientReference")?.trim() ||
    url.searchParams.get("ClientReference")?.trim() ||
    ""
  );
}

function extractReferenceFromUnknownBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }
  const root = body as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : Array.isArray(root.data) && root.data[0] && typeof root.data[0] === "object"
        ? (root.data[0] as Record<string, unknown>)
        : null;

  const candidates = [
    root.clientReference,
    root.ClientReference,
    root.reference,
    root.Reference,
    data?.clientReference,
    data?.ClientReference,
    data?.reference,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function settleAndRedirect(reference: string): Promise<NextResponse> {
  const classification = await settlePaymentIngest(reference, "callback");
  await recordCallbackOutcomeAudit(reference, classification, {
    event: "callback",
  });

  if (
    classification.category === "settled" ||
    classification.category === "already_settled"
  ) {
    return NextResponse.redirect(buildPaymentsRedirect("/payments?verified=1"));
  }

  if (classification.ack === "rejected_permanent") {
    console.warn("[payments callback] permanent settlement rejection", {
      reference,
      category: classification.category,
    });
  } else if (classification.ack === "retryable") {
    console.error("[payments callback] retryable settlement failure", {
      reference,
      category: classification.category,
    });
  } else {
    console.info("[payments callback] settlement not verified", {
      reference,
      category: classification.category,
    });
  }

  // Pending/Unpaid after callback is expected when Hubtel has not yet marked Paid.
  if (classification.category === "non_success_status") {
    return NextResponse.redirect(
      buildPaymentsRedirect("/payments?pending=1"),
    );
  }

  return NextResponse.redirect(
    buildPaymentsRedirect("/payments?error=verification_failed"),
  );
}

export async function GET(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    await recordCallbackOutcomeAudit(null, {
      ack: "retryable",
      category: "service_unavailable",
      message: "Firebase Admin is not configured for payment callback.",
      httpStatus: 503,
    });
    return NextResponse.redirect(
      buildPaymentsRedirect("/payments?error=unavailable"),
    );
  }

  const url = new URL(request.url);
  const reference = extractReferenceFromSearchParams(url);

  if (!reference) {
    await recordCallbackOutcomeAudit(null, {
      ack: "rejected_permanent",
      category: "missing_reference",
      message: "Payment callback is missing reference.",
      httpStatus: 400,
    });
    return NextResponse.redirect(
      buildPaymentsRedirect("/payments?error=missing_reference"),
    );
  }

  return settleAndRedirect(reference);
}

/**
 * Hubtel may POST notification payloads to callbackUrl.
 * Body status claims are ignored; only the clientReference is used to look up
 * our pending payment, then Hubtel status API is queried server-side.
 *
 * Exact Hubtel callback authentication is not documented in-repo; we do not
 * invent a signature scheme. Settlement remains gated by status verification
 * and an existing Firestore payment for the reference.
 */
export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    await recordCallbackOutcomeAudit(null, {
      ack: "retryable",
      category: "service_unavailable",
      message: "Firebase Admin is not configured for payment callback.",
      httpStatus: 503,
    });
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const url = new URL(request.url);
  let reference = extractReferenceFromSearchParams(url);

  if (!reference) {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    reference = extractReferenceFromUnknownBody(body);
  }

  if (!reference) {
    await recordCallbackOutcomeAudit(null, {
      ack: "rejected_permanent",
      category: "missing_reference",
      message: "Payment callback is missing reference.",
      httpStatus: 400,
    });
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const classification = await settlePaymentIngest(reference, "callback");
  await recordCallbackOutcomeAudit(reference, classification, {
    event: "callback_post",
  });

  return NextResponse.json(
    {
      received: true,
      outcome: classification.ack,
      category: classification.category,
    },
    { status: classification.httpStatus >= 500 ? classification.httpStatus : 200 },
  );
}
