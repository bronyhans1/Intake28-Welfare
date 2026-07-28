export const PaymentAuditAction = {
  PAYMENT_INITIALIZED: "payment_initialized",
  PAYMENT_VERIFIED: "payment_verified",
  PAYMENT_CONTRIBUTION_CREATED: "payment_contribution_created",
} as const;

export type PaymentAuditAction =
  (typeof PaymentAuditAction)[keyof typeof PaymentAuditAction];
