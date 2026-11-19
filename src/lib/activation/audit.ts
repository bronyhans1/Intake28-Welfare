import type { ActivationValidationErrorCode } from "@/types/activation";

export type ActivationAuditAction =
  | "activation_validation_success"
  | "activation_validation_failure";

export interface ActivationAuditEvent {
  action: ActivationAuditAction;
  serviceNumber: string;
  userId?: string;
  code?: ActivationValidationErrorCode;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logging hook for activation events.
 * Phase 2B: persist to audit_logs collection via Admin SDK.
 */
export async function logActivationAuditEvent(
  event: ActivationAuditEvent,
): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    console.info("[activation:audit]", event);
  }
}
