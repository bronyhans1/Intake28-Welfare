import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { verifyPaystackWebhookSignature } from "@/lib/integrations/paystack/webhook-signature";
import {
  PaymentSettlementError,
  settlePaymentFromPaystackReference,
} from "@/lib/payments/settlement";

export const dynamic = "force-dynamic";

interface PaystackWebhookEvent {
  event: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let payload: PaystackWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const eventType = payload.event;

  if (eventType === "charge.success") {
    const reference = payload.data?.reference?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    try {
      await settlePaymentFromPaystackReference(reference, { source: "webhook" });
      return NextResponse.json({ received: true });
    } catch (error) {
      if (error instanceof PaymentSettlementError) {
        console.warn("[paystack webhook] settlement rejected", {
          reference,
          message: error.message,
        });
        return NextResponse.json({ received: true, skipped: true });
      }

      console.error("[paystack webhook] processing error", {
        event: eventType,
        reference,
      });
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  if (eventType === "charge.failed") {
    console.info("[paystack webhook] charge.failed ignored", {
      reference: payload.data?.reference,
    });
    return NextResponse.json({ received: true });
  }

  console.info("[paystack webhook] unsupported event", { event: eventType });
  return NextResponse.json({ received: true });
}
