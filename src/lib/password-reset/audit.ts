export const PasswordResetAuditAction = {
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
} as const;

export type PasswordResetAuditAction =
  (typeof PasswordResetAuditAction)[keyof typeof PasswordResetAuditAction];
