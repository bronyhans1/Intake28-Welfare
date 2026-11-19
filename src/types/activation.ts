/** Activation flow types — Phase 2A+ */

export type ActivationStep = "otp" | "password";

export interface ActivationContext {
  userId: string;
  serviceNumber: string;
  phoneNumber: string;
  step: ActivationStep;
}

export type ActivationValidationErrorCode =
  | "NOT_FOUND"
  | "ALREADY_ACTIVATED"
  | "NOT_ELIGIBLE"
  | "INVALID_INPUT"
  | "SERVER_ERROR";

export type ActivationValidationResult =
  | {
      success: true;
      context: ActivationContext;
    }
  | {
      success: false;
      error: string;
      code: ActivationValidationErrorCode;
      fieldErrors?: Partial<
        Record<"serviceNumberSuffix" | "phoneNumber", string[]>
      >;
    };

export type ActivationActionState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"serviceNumberSuffix" | "phoneNumber", string[]>
  >;
};

export type OtpActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  retryAfterSeconds?: number;
  lockedUntil?: string;
  fieldErrors?: Partial<Record<"otp", string[]>>;
};

export type PasswordActionState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"password" | "confirmPassword", string[]>
  >;
};

export type OtpDeliveryStatus = {
  sent: boolean;
  message?: string;
  retryAfterSeconds?: number;
  lockedUntil?: string;
};
