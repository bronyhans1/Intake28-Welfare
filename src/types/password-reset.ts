/** Password reset flow types — Phase 5C */

export type PasswordResetStep = "otp" | "reset";

export interface PasswordResetContext {
  userId: string;
  serviceNumber: string;
  phoneNumber: string;
  step: PasswordResetStep;
}

export type PasswordResetActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  fieldErrors?: Partial<
    Record<"serviceNumberSuffix" | "phoneNumber", string[]>
  >;
};

export type PasswordResetOtpActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  retryAfterSeconds?: number;
  lockedUntil?: string;
  fieldErrors?: Partial<Record<"otp", string[]>>;
};

export type PasswordResetPasswordActionState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"password" | "confirmPassword", string[]>
  >;
};

export type PasswordResetOtpDeliveryStatus = {
  sent: boolean;
  message?: string;
  retryAfterSeconds?: number;
  lockedUntil?: string;
};

export interface PasswordResetRequestResult {
  matched: boolean;
  message: string;
  context?: PasswordResetContext;
}

export type PasswordResetOtpVerificationResult =
  | { success: true }
  | {
      success: false;
      error: string;
      retryAfterSeconds?: number;
      lockedUntil?: string;
      isLocked?: boolean;
    };
