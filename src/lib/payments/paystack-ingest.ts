import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  PaymentSettlementError,
  settlePaymentFromPaystackReference,
  PAYSTACK_SETTLEMENT_ACTOR,
  type PaymentSettlementOutcome,
  type PaymentSettlementSource,
} from "@/lib/payments/settlement";

export type PaystackIngestAck =
  | "processed"
  | "ignored"
  | "rejected_permanent"
  | "retryable";

export type PaystackIngestCategory =
  | "settled"
  | "already_settled"
  | "non_success_status"
  | "unsupported_event"
  | "charge_failed_ignored"
  | "invalid_signature"
  | "invalid_payload"
  | "missing_reference"
  | "payment_not_found"
  | "amount_mismatch"
  | "currency_mismatch"
  | "reference_mismatch"
  | "validation_rejected"
  | "paystack_verify_unavailable"
  | "service_unavailable"
  | "post_success_recording_error"
  | "unexpected_error";

export interface PaystackIngestClassification {
  ack: PaystackIngestAck;
  category: PaystackIngestCategory;
  message: string;
  settlementOutcome?: PaymentSettlementOutcome;
  httpStatus: number;
}

function categoryFromSettlementMessage(message: string): PaystackIngestCategory {
  const lower = message.toLowerCase();
  if (lower.includes("not found")) return "payment_not_found";
  if (lower.includes("amount")) return "amount_mismatch";
  if (lower.includes("currency")) return "currency_mismatch";
  if (lower.includes("reference")) return "reference_mismatch";
  return "validation_rejected";
}

/**
 * Classify settlement failures for webhook acknowledgement.
 *
 * Paystack retries on non-2xx. Permanent business/validation failures must
 * return 2xx so delivery stops. Transient verify/infra failures return 5xx.
 */
export function classifySettlementFailure(error: unknown): PaystackIngestClassification {
  if (error instanceof PaymentSettlementError) {
    if (error.retryable) {
      return {
        ack: "retryable",
        category: "paystack_verify_unavailable",
        message: error.message,
        httpStatus: 503,
      };
    }
    return {
      ack: "rejected_permanent",
      category: categoryFromSettlementMessage(error.message),
      message: error.message,
      httpStatus: 200,
    };
  }

  const message =
    error instanceof Error ? error.message : "Unexpected settlement failure.";
  // SUCCESS may already be written; Paystack retry should heal via already_settled.
  if (
    message.toLowerCase().includes("contribution") ||
    message.toLowerCase().includes("receipt")
  ) {
    return {
      ack: "retryable",
      category: "post_success_recording_error",
      message,
      httpStatus: 500,
    };
  }

  return {
    ack: "retryable",
    category: "unexpected_error",
    message,
    httpStatus: 500,
  };
}

export function classifySettlementResult(
  outcome: PaymentSettlementOutcome,
  message?: string,
): PaystackIngestClassification {
  if (outcome === "settled") {
    return {
      ack: "processed",
      category: "settled",
      message: message ?? "Payment settled successfully.",
      settlementOutcome: outcome,
      httpStatus: 200,
    };
  }
  if (outcome === "already_settled") {
    return {
      ack: "processed",
      category: "already_settled",
      message: message ?? "Payment was already settled.",
      settlementOutcome: outcome,
      httpStatus: 200,
    };
  }
  return {
    ack: "processed",
    category: "non_success_status",
    message: message ?? `Paystack reported status outcome: ${outcome}.`,
    settlementOutcome: outcome,
    httpStatus: 200,
  };
}

async function recordIngestAudit(
  action:
    | typeof PaymentAuditAction.PAYMENT_WEBHOOK_OUTCOME
    | typeof PaymentAuditAction.PAYMENT_CALLBACK_OUTCOME,
  reference: string | null,
  classification: PaystackIngestClassification,
  extras: Record<string, unknown> = {},
): Promise<void> {
  try {
    await createAuditLog({
      action,
      entityType: "payment",
      entityId: reference ?? "paystack-ingest",
      ...buildAuditActor(PAYSTACK_SETTLEMENT_ACTOR),
      metadata: {
        paymentReference: reference,
        outcome: classification.ack,
        category: classification.category,
        settlementOutcome: classification.settlementOutcome ?? null,
        httpStatus: classification.httpStatus,
        // Safe short message only — never secrets or full payloads.
        message: classification.message.slice(0, 240),
        ...extras,
      },
    });
  } catch (error) {
    console.error("[paystack ingest] audit write failed", {
      action,
      reference,
      category: classification.category,
    });
    void error;
  }
}

export async function recordWebhookOutcomeAudit(
  reference: string | null,
  classification: PaystackIngestClassification,
  extras: Record<string, unknown> = {},
): Promise<void> {
  await recordIngestAudit(
    PaymentAuditAction.PAYMENT_WEBHOOK_OUTCOME,
    reference,
    classification,
    extras,
  );
}

export async function recordCallbackOutcomeAudit(
  reference: string | null,
  classification: PaystackIngestClassification,
  extras: Record<string, unknown> = {},
): Promise<void> {
  await recordIngestAudit(
    PaymentAuditAction.PAYMENT_CALLBACK_OUTCOME,
    reference,
    classification,
    extras,
  );
}

/**
 * Run shared settlement for webhook/callback and classify the durable outcome.
 */
export async function settlePaystackIngest(
  reference: string,
  source: Extract<PaymentSettlementSource, "webhook" | "callback">,
): Promise<PaystackIngestClassification> {
  try {
    const result = await settlePaymentFromPaystackReference(reference, { source });
    return classifySettlementResult(result.outcome, result.message);
  } catch (error) {
    return classifySettlementFailure(error);
  }
}
