import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  recordCallbackOutcomeAudit,
  settlePaystackIngest,
} from "@/lib/payments/paystack-ingest";

export const dynamic = "force-dynamic";

/**
 * Browser callbacks are not Paystack webhook retries. Failures redirect the
 * member to a safe payments page error without exposing internals. Durable
 * outcome audits make callback failures observable for operators. Settlement
 * remains idempotent via the shared settlement service.
 */

function buildPaymentsRedirect(path: string): string {
  const base = env.client().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

export async function GET(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    await recordCallbackOutcomeAudit(null, {
      ack: "retryable",
      category: "service_unavailable",
      message: "Firebase Admin is not configured for payment callback.",
      httpStatus: 503,
    });
    return NextResponse.redirect(buildPaymentsRedirect("/payments?error=unavailable"));
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference")?.trim() ?? "";

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

  const classification = await settlePaystackIngest(reference, "callback");
  await recordCallbackOutcomeAudit(reference, classification, { event: "callback" });

  if (
    classification.category === "settled" ||
    classification.category === "already_settled"
  ) {
    return NextResponse.redirect(buildPaymentsRedirect("/payments?verified=1"));
  }

  if (classification.ack === "rejected_permanent") {
    console.warn("[paystack callback] permanent settlement rejection", {
      reference,
      category: classification.category,
    });
  } else if (classification.ack === "retryable") {
    console.error("[paystack callback] retryable settlement failure", {
      reference,
      category: classification.category,
    });
  } else {
    console.info("[paystack callback] settlement not verified", {
      reference,
      category: classification.category,
    });
  }

  return NextResponse.redirect(
    buildPaymentsRedirect("/payments?error=verification_failed"),
  );
}
