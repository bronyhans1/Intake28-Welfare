"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  ensurePasswordResetOtp,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "@/lib/password-reset/otp-service";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset/repository";
import {
  clearPasswordResetContext,
  getPasswordResetContext,
  requirePasswordResetContext,
  setPasswordResetContext,
} from "@/lib/password-reset/session";
import { otpVerificationSchema } from "@/lib/validators/activation";
import { activationPasswordSchema } from "@/lib/validators/password";
import type {
  PasswordResetActionState,
  PasswordResetOtpActionState,
  PasswordResetPasswordActionState,
} from "@/types/password-reset";

export async function submitPasswordResetRequest(
  input: unknown,
): Promise<PasswordResetActionState> {
  try {
    if (!isFirebaseAdminConfigured()) {
      return {
        error: "Password reset is temporarily unavailable. Please try again later.",
      };
    }

    const result = await requestPasswordReset(input);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    if (result.matched && result.context) {
      await setPasswordResetContext(result.context);
      redirect("/forgot-password/verify");
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: "Unable to process your request. Please try again later.",
    };
  }
}

export async function initializePasswordResetOtp(): Promise<{
  status: Awaited<ReturnType<typeof ensurePasswordResetOtp>>;
  maskedPhone: string | null;
}> {
  const context = await requirePasswordResetContext("otp");
  const status = await ensurePasswordResetOtp(context);

  const maskedPhone = context.phoneNumber.replace(
    /(\d{3})\d+(\d{3})/,
    "$1XXXXX$2",
  );

  return { status, maskedPhone };
}

export async function resendPasswordResetOtp(): Promise<PasswordResetOtpActionState> {
  const context = await requirePasswordResetContext("otp");
  const result = await sendPasswordResetOtp(context, { forceResend: true });

  if (!result.sent) {
    return {
      error: result.message,
      retryAfterSeconds: result.retryAfterSeconds,
      lockedUntil: result.lockedUntil,
    };
  }

  return {
    success: true,
    message: result.message,
  };
}

export async function submitPasswordResetOtpVerification(
  input: unknown,
): Promise<PasswordResetOtpActionState> {
  try {
    const context = await requirePasswordResetContext("otp");
    const parsed = otpVerificationSchema.safeParse(input);

    if (!parsed.success) {
      return {
        error: "Please enter a valid 6-digit code.",
        fieldErrors: {
          otp: parsed.error.flatten().fieldErrors.otp,
        },
      };
    }

    const result = await verifyPasswordResetOtp(context, parsed.data.otp);

    if (!result.success) {
      return {
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
        lockedUntil: result.lockedUntil,
      };
    }

    redirect("/forgot-password/reset");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: "Unable to verify your code. Please try again.",
    };
  }
}

export async function submitPasswordResetPassword(
  input: unknown,
): Promise<PasswordResetPasswordActionState> {
  try {
    const context = await requirePasswordResetContext("reset");
    const parsed = activationPasswordSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return {
        error: "Please correct the errors below.",
        fieldErrors: {
          password: fieldErrors.password,
          confirmPassword: fieldErrors.confirmPassword,
        },
      };
    }

    await resetPassword(context, parsed.data.password);
    await clearPasswordResetContext();
    redirect("/forgot-password/success");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to reset your password. Please try again.";

    return { error: message };
  }
}

export async function getPasswordResetStepContext(): Promise<{
  serviceNumber: string;
} | null> {
  const context = await getPasswordResetContext();
  if (!context || context.step !== "reset") {
    return null;
  }
  return { serviceNumber: context.serviceNumber };
}
