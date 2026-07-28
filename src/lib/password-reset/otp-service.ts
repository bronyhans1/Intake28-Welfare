import { findUserById } from "@/lib/activation/repository";
import { updatePasswordResetOtpTracking } from "@/lib/password-reset/repository";
import {
  generatePasswordResetOtpCode,
  getPasswordResetOtpExpiry,
  hashPasswordResetOtp,
  isPasswordResetOtpExpired,
  verifyPasswordResetOtpHash,
} from "@/lib/password-reset/otp";
import { updatePasswordResetContext } from "@/lib/password-reset/session";
import {
  computePasswordResetOtpFailedAttemptUpdate,
  computePasswordResetOtpSentUpdate,
  computePasswordResetOtpSuccessReset,
  evaluatePasswordResetOtpRequestEligibility,
  isPasswordResetOtpLocked,
  toPasswordResetOtpExpiresDate,
  toPasswordResetOtpTrackingFields,
} from "@/lib/utils/password-reset-otp";
import type {
  PasswordResetContext,
  PasswordResetOtpDeliveryStatus,
  PasswordResetOtpVerificationResult,
} from "@/types/password-reset";
import type { User } from "@/types/user";

function logDevOtp(userId: string, serviceNumber: string): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[password-reset:otp:dev] Check server logs for OTP — userId=${userId} serviceNumber=${serviceNumber}`,
    );
  }
}

function logDevOtpCode(
  userId: string,
  serviceNumber: string,
  otp: string,
): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[password-reset:otp:dev] OTP for ${serviceNumber} (userId=${userId}): ${otp}`,
    );
  }
}

function mapEligibilityToStatus(
  eligibility: ReturnType<typeof evaluatePasswordResetOtpRequestEligibility>,
): PasswordResetOtpDeliveryStatus {
  if (eligibility.canRequest) {
    return { sent: false };
  }

  return {
    sent: false,
    message:
      eligibility.reason === "locked"
        ? "Too many failed attempts. OTP requests are temporarily locked."
        : eligibility.reason === "cooldown"
          ? "Please wait before requesting another code."
          : "OTP cannot be sent for this account.",
    retryAfterSeconds: eligibility.retryAfterSeconds,
    lockedUntil: eligibility.lockedUntil?.toISOString(),
  };
}

function hasActivePasswordResetOtp(
  user: Pick<User, "passwordResetOtp" | "passwordResetOtpExpiresAt">,
  now: Date = new Date(),
): boolean {
  if (!user.passwordResetOtp) {
    return false;
  }

  const expiresAt = toPasswordResetOtpExpiresDate(
    user.passwordResetOtpExpiresAt as Parameters<
      typeof toPasswordResetOtpExpiresDate
    >[0],
  );

  return !isPasswordResetOtpExpired(expiresAt, now);
}

export async function sendPasswordResetOtp(
  context: PasswordResetContext,
  options?: { forceResend?: boolean },
): Promise<PasswordResetOtpDeliveryStatus> {
  const user = await findUserById(context.userId);

  if (!user) {
    return { sent: false, message: "Member record not found." };
  }

  const tracking = toPasswordResetOtpTrackingFields(user);
  const eligibility = evaluatePasswordResetOtpRequestEligibility(tracking);

  if (!eligibility.canRequest) {
    return mapEligibilityToStatus(eligibility);
  }

  if (!options?.forceResend && hasActivePasswordResetOtp(user)) {
    return {
      sent: true,
      message:
        "A verification code has already been sent. Check your server logs in development.",
    };
  }

  const otp = generatePasswordResetOtpCode();
  const now = new Date();
  const sentUpdate = computePasswordResetOtpSentUpdate(now);
  const expiresAt = getPasswordResetOtpExpiry(now);

  await updatePasswordResetOtpTracking(context.userId, {
    passwordResetOtp: hashPasswordResetOtp(context.userId, otp),
    passwordResetOtpExpiresAt: expiresAt,
    passwordResetLastOtpSentAt: sentUpdate.passwordResetLastOtpSentAt,
    passwordResetRequestedAt: sentUpdate.passwordResetRequestedAt,
  });

  logDevOtpCode(context.userId, context.serviceNumber, otp);
  logDevOtp(context.userId, context.serviceNumber);

  return {
    sent: true,
    message:
      process.env.NODE_ENV === "development"
        ? "Verification code sent. Check the server terminal for the OTP."
        : "Verification code sent to your registered phone number.",
  };
}

export async function ensurePasswordResetOtp(
  context: PasswordResetContext,
): Promise<PasswordResetOtpDeliveryStatus> {
  return sendPasswordResetOtp(context, { forceResend: false });
}

export async function verifyPasswordResetOtp(
  context: PasswordResetContext,
  otp: string,
): Promise<PasswordResetOtpVerificationResult> {
  const user = await findUserById(context.userId);

  if (!user) {
    return { success: false, error: "Member record not found." };
  }

  if (isPasswordResetOtpLocked(user.passwordResetLockedUntil)) {
    return {
      success: false,
      error:
        "Too many failed attempts. OTP verification is temporarily locked.",
      isLocked: true,
      lockedUntil: user.passwordResetLockedUntil
        ? toPasswordResetOtpExpiresDate(user.passwordResetLockedUntil)?.toISOString()
        : undefined,
    };
  }

  const expiresAt = toPasswordResetOtpExpiresDate(user.passwordResetOtpExpiresAt);
  const isValid =
    !isPasswordResetOtpExpired(expiresAt) &&
    verifyPasswordResetOtpHash(context.userId, otp, user.passwordResetOtp);

  if (!isValid) {
    const failedUpdate = computePasswordResetOtpFailedAttemptUpdate(
      user.passwordResetOtpAttempts ?? 0,
    );

    await updatePasswordResetOtpTracking(context.userId, {
      passwordResetOtpAttempts: failedUpdate.passwordResetOtpAttempts,
      passwordResetLockedUntil: failedUpdate.passwordResetLockedUntil,
      ...(failedUpdate.isLocked
        ? {
            passwordResetOtp: null,
            passwordResetOtpExpiresAt: null,
          }
        : {}),
    });

    if (failedUpdate.isLocked) {
      return {
        success: false,
        error:
          "Too many failed attempts. OTP verification is locked for 15 minutes.",
        isLocked: true,
        lockedUntil: failedUpdate.passwordResetLockedUntil?.toISOString(),
      };
    }

    return {
      success: false,
      error: "Invalid or expired verification code. Please try again.",
    };
  }

  const reset = computePasswordResetOtpSuccessReset();
  await updatePasswordResetOtpTracking(context.userId, reset);
  await updatePasswordResetContext({ ...context, step: "reset" });

  return { success: true };
}
