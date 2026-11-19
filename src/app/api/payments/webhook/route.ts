import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { PaystackConfigurationError } from "@/lib/integrations/paystack/client";
import { verifyPaystackWebhookSignature } from "@/lib/integrations/paystack/webhook-signature";
import {
  recordWebhookOutcomeAudit,
  settlePaystackIngest,
  type PaystackIngestClassification,
} from "@/lib/payments/paystack-ingest";

export const dynamic = "force-dynamic";

/**
 * Webhook acknowledgement policy (Paystack retries non-2xx):
 * - 2xx: processed, ignored unsupported events, or permanent validation/business rejects
 *   (amount/currency/reference/not found). Stopping retries avoids poison loops.
 * - 401: invalid signature (do not settle).
 * - 400: malformed body / missing reference on charge.success.
 * - 503/500: transient infra or post-SUCCESS recording failures so Paystack retries;
 *   shared settlement remains idempotent on replay.
 */

interface PaystackWebhookEvent {
  event?: unknown;
  data?: {
    reference?: unknown;
    status?: unknown;
    amount?: unknown;
    currency?: unknown;
  };
}

function json(
  classification: PaystackIngestClassification,
  body: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ...body,
      outcome: classification.ack,
      category: classification.category,
    },
    { status: classification.httpStatus },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  let signatureValid = false;
  try {
    signatureValid = verifyPaystackWebhookSignature(rawBody, signature);
  } catch (error) {
    if (error instanceof PaystackConfigurationError) {
      const classification: PaystackIngestClassification = {
        ack: "retryable",
        category: "service_unavailable",
        message: "Paystack webhook secret is not configured.",
        httpStatus: 503,
      };
      await recordWebhookOutcomeAudit(null, classification, { event: "signature_check" });
      return json(classification, { error: "Service unavailable" });
    }
    throw error;
  }

  if (!signatureValid) {
    const classification: PaystackIngestClassification = {
      ack: "rejected_permanent",
      category: "invalid_signature",
      message: "Invalid Paystack webhook signature.",
      httpStatus: 401,
    };
    // No audit with untrusted body reference — signature failed.
    console.warn("[paystack webhook] invalid signature");
    return json(classification, { error: "Invalid signature" });
  }

  if (!isFirebaseAdminConfigured()) {
    const classification: PaystackIngestClassification = {
      ack: "retryable",
      category: "service_unavailable",
      message: "Firebase Admin is not configured.",
      httpStatus: 503,
    };
    await recordWebhookOutcomeAudit(null, classification, { event: "charge.success" });
    return json(classification, { error: "Service unavailable" });
  }

  let payload: PaystackWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    const classification: PaystackIngestClassification = {
      ack: "rejected_permanent",
      category: "invalid_payload",
      message: "Webhook body is not valid JSON.",
      httpStatus: 400,
    };
    await recordWebhookOutcomeAudit(null, classification);
    return json(classification, { error: "Invalid request body" });
  }

  const eventType = typeof payload.event === "string" ? payload.event : "";
  if (!eventType) {
    const classification: PaystackIngestClassification = {
      ack: "rejected_permanent",
      category: "invalid_payload",
      message: "Webhook event type is missing.",
      httpStatus: 400,
    };
    await recordWebhookOutcomeAudit(null, classification);
    return json(classification, { error: "Invalid event" });
  }

  if (eventType === "charge.success") {
    const reference =
      typeof payload.data?.reference === "string"
        ? payload.data.reference.trim()
        : "";
    if (!reference) {
      const classification: PaystackIngestClassification = {
        ack: "rejected_permanent",
        category: "missing_reference",
        message: "charge.success webhook is missing data.reference.",
        httpStatus: 400,
      };
      await recordWebhookOutcomeAudit(null, classification, { event: eventType });
      return json(classification, { error: "Missing reference" });
    }

    const classification = await settlePaystackIngest(reference, "webhook");
    await recordWebhookOutcomeAudit(reference, classification, { event: eventType });

    if (classification.ack === "retryable") {
      console.error("[paystack webhook] retryable settlement failure", {
        reference,
        category: classification.category,
      });
      return json(classification, { error: "Processing failed" });
    }

    if (classification.ack === "rejected_permanent") {
      console.warn("[paystack webhook] permanent settlement rejection", {
        reference,
        category: classification.category,
      });
      return json(classification, { received: true, skipped: true });
    }

    return json(classification, { received: true });
  }

  if (eventType === "charge.failed") {
    const reference =
      typeof payload.data?.reference === "string"
        ? payload.data.reference.trim()
        : null;
    const classification: PaystackIngestClassification = {
      ack: "ignored",
      category: "charge_failed_ignored",
      message: "charge.failed webhook acknowledged without settlement.",
      httpStatus: 200,
    };
    await recordWebhookOutcomeAudit(reference, classification, { event: eventType });
    console.info("[paystack webhook] charge.failed ignored", { reference });
    return json(classification, { received: true });
  }

  const classification: PaystackIngestClassification = {
    ack: "ignored",
    category: "unsupported_event",
    message: `Unsupported webhook event: ${eventType}`,
    httpStatus: 200,
  };
  await recordWebhookOutcomeAudit(null, classification, { event: eventType });
  console.info("[paystack webhook] unsupported event", { event: eventType });
  return json(classification, { received: true });
}
