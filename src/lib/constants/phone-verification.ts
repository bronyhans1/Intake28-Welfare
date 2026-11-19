/** Phone verification OTP rate-limiting constants. */
export const PHONE_VERIFICATION_OTP = {
  /** OTP code validity in minutes */
  CODE_EXPIRY_MINUTES: 5,
  /** Maximum failed verification attempts per request */
  MAX_ATTEMPTS: 3,
  /** Maximum OTP resend requests per verification */
  MAX_RESENDS: 3,
} as const;
