"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  requestPhoneVerification,
  resendPhoneVerification,
  verifyPhoneVerification,
} from "@/lib/phone-verification/repository";
import {
  phoneChangeRequestSchema,
  phoneVerificationOtpSchema,
  phoneVerificationResendSchema,
} from "@/lib/validators/phone-verification";

export type PhoneVerificationActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  verificationId?: string;
  expiresAt?: string;
  devOtp?: string;
  message?: string;
  newPhone?: string;
};

const SERVER_UNAVAILABLE =
  "Phone verification is temporarily unavailable. Please try again later.";

export async function requestPhoneVerificationAction(
  input: { newPhone: string },
): Promise<PhoneVerificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in to change your phone number." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to update your profile." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = phoneChangeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please enter a valid phone number.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await requestPhoneVerification(
      actor.uid,
      parsed.data.newPhone,
      actor,
    );

    return {
      success: true,
      verificationId: result.verificationId,
      expiresAt: result.expiresAt,
      devOtp: result.devOtp,
      message: result.message,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to send verification code.",
    };
  }
}

export async function resendPhoneVerificationAction(
  input: { verificationId: string },
): Promise<PhoneVerificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to update your profile." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = phoneVerificationResendSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid verification session." };
  }

  try {
    const result = await resendPhoneVerification(parsed.data.verificationId, actor);
    return {
      success: true,
      verificationId: result.verificationId,
      expiresAt: result.expiresAt,
      devOtp: result.devOtp,
      message: result.message,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to resend verification code.",
    };
  }
}

export async function verifyPhoneVerificationAction(
  input: { verificationId: string; otp: string },
): Promise<PhoneVerificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return { error: "You must be signed in." };
  }

  if (!hasPermission(actor.role, Permission.UPDATE_PROFILE)) {
    return { error: "You do not have permission to update your profile." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = phoneVerificationOtpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Please enter a valid verification code.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await verifyPhoneVerification(
      parsed.data.verificationId,
      parsed.data.otp,
      actor,
    );

    if (!result.success) {
      return { error: result.error ?? "Verification failed." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/profile/edit");

    return {
      success: true,
      newPhone: result.newPhone,
      message: "Phone number verified and updated successfully.",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Verification failed.",
    };
  }
}
