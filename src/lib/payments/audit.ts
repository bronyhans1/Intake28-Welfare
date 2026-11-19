export const PaymentAuditAction = {
  PAYMENT_INITIALIZED: "payment_initialized",
  PAYMENT_VERIFIED: "payment_verified",
  PAYMENT_CONTRIBUTION_CREATED: "payment_contribution_created",
  /** Authorized reconciliation recovery of a Paystack success into portal records. */
  PAYMENT_RECOVERY: "payment_recovery",
  /** Durable webhook acknowledgement / skip / retry classification (no secrets). */
  PAYMENT_WEBHOOK_OUTCOME: "payment_webhook_outcome",
  /** Durable callback settlement outcome for observability (no secrets). */
  PAYMENT_CALLBACK_OUTCOME: "payment_callback_outcome",
  /** Durable Hubtel RMSC status lookup outcome (e.g. no_record / 4720). */
  PAYMENT_HUBTEL_STATUS_LOOKUP: "payment_hubtel_status_lookup",
} as const;

export type PaymentAuditAction =
  (typeof PaymentAuditAction)[keyof typeof PaymentAuditAction];
