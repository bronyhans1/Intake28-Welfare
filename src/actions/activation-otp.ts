"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { completeMemberActivation } from "@/lib/activation/complete";
import {
  ensureActivationOtp,
  sendActivationOtp,
  verifyActivationOtp,
} from "@/lib/activation/otp-service";
import {
  getActivationContext,
  requireActivationContext,
  clearActivationContext,
} from "@/lib/activation/session";
import { otpVerificationSchema } from "@/lib/validators/activation";
import { activationPasswordSchema } from "@/lib/validators/password";
import type { OtpActionState, PasswordActionState } from "@/types/activation";

export async function initializeActivationOtp(): Promise<{
  status: Awaited<ReturnType<typeof ensureActivationOtp>>;
  maskedPhone: string | null;
}> {
  const context = await requireActivationContext("otp");
  const status = await ensureActivationOtp(context);

  const maskedPhone = context.phoneNumber.replace(
    /(\d{3})\d+(\d{3})/,
    "$1XXXXX$2",
  );

  return { status, maskedPhone };
}

export async function resendActivationOtp(): Promise<OtpActionState> {
  const context = await requireActivationContext("otp");
  const result = await sendActivationOtp(context, { forceResend: true });

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

export async function submitOtpVerification(
  input: unknown,
): Promise<OtpActionState> {
  try {
    const context = await requireActivationContext("otp");
    const parsed = otpVerificationSchema.safeParse(input);

    if (!parsed.success) {
      return {
        error: "Please enter a valid 6-digit code.",
        fieldErrors: {
          otp: parsed.error.flatten().fieldErrors.otp,
        },
      };
    }

    const result = await verifyActivationOtp(context, parsed.data.otp);

    if (!result.success) {
      return {
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
        lockedUntil: result.lockedUntil,
      };
    }

    redirect("/activate-account/password");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: "Unable to verify your code. Please try again.",
    };
  }
}

export async function submitActivationPassword(
  input: unknown,
): Promise<PasswordActionState> {
  try {
    const context = await requireActivationContext("password");
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

    await completeMemberActivation(context.userId, parsed.data.password);
    await clearActivationContext();
    redirect("/activate-account/success");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to activate your account. Please try again.";

    return { error: message };
  }
}

export async function getPasswordStepContext(): Promise<{
  serviceNumber: string;
} | null> {
  const context = await getActivationContext();
  if (!context || context.step !== "password") {
    return null;
  }
  return { serviceNumber: context.serviceNumber };
}
