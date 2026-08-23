import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  PaymentSettlementError,
  settlePaymentFromPaystackReference,
} from "@/lib/payments/settlement";

export const dynamic = "force-dynamic";

function buildPaymentsRedirect(path: string): string {
  const base = env.client().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path}`;
}

export async function GET(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.redirect(buildPaymentsRedirect("/payments?error=unavailable"));
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference")?.trim();

  if (!reference) {
    return NextResponse.redirect(buildPaymentsRedirect("/payments?error=missing_reference"));
  }

  try {
    const result = await settlePaymentFromPaystackReference(reference, {
      source: "callback",
    });

    if (
      result.outcome === "settled" ||
      result.outcome === "already_settled"
    ) {
      return NextResponse.redirect(buildPaymentsRedirect("/payments?verified=1"));
    }

    return NextResponse.redirect(buildPaymentsRedirect("/payments?error=verification_failed"));
  } catch (error) {
    if (error instanceof PaymentSettlementError) {
      console.warn("[paystack callback] settlement rejected", {
        reference,
        message: error.message,
      });
    } else {
      console.error("[paystack callback] unexpected error", { reference });
    }

    return NextResponse.redirect(buildPaymentsRedirect("/payments?error=verification_failed"));
  }
}
