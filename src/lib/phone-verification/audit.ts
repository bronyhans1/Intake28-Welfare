export const PhoneVerificationAuditAction = {
  PHONE_VERIFICATION_REQUESTED: "phone_verification_requested",
  PHONE_VERIFICATION_COMPLETED: "phone_verification_completed",
  PHONE_VERIFICATION_EXPIRED: "phone_verification_expired",
  PHONE_VERIFICATION_FAILED: "phone_verification_failed",
} as const;

export type PhoneVerificationAuditAction =
  (typeof PhoneVerificationAuditAction)[keyof typeof PhoneVerificationAuditAction];
