import { logActivationAuditEvent } from "@/lib/activation/audit";
import {
  findUserById,
  updateUserOtpTracking,
} from "@/lib/activation/repository";
import {
  clearOtpCode,
  generateOtpCode,
  hasActiveOtpCode,
  storeOtpCode,
  verifyOtpCode,
} from "@/lib/activation/otp-store";
import { updateActivationContext } from "@/lib/activation/session";
import {
  computeOtpFailedAttemptUpdate,
  computeOtpSentUpdate,
  computeOtpSuccessReset,
  evaluateOtpRequestEligibility,
  isOtpLocked,
} from "@/lib/utils/activation-otp";
import type { ActivationContext, OtpDeliveryStatus } from "@/types/activation";

function logDevOtp(userId: string, serviceNumber: string): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[activation:otp:dev] Check server logs for OTP — userId=${userId} serviceNumber=${serviceNumber}`,
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
      `[activation:otp:dev] OTP for ${serviceNumber} (userId=${userId}): ${otp}`,
    );
  }
}

function mapEligibilityToStatus(
  eligibility: ReturnType<typeof evaluateOtpRequestEligibility>,
): OtpDeliveryStatus {
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

export async function sendActivationOtp(
  context: ActivationContext,
  options?: { forceResend?: boolean },
): Promise<OtpDeliveryStatus> {
  const user = await findUserById(context.userId);

  if (!user) {
    return { sent: false, message: "Member record not found." };
  }

  const eligibility = evaluateOtpRequestEligibility({
    activationStatus: user.activationStatus,
    lastOtpSentAt: user.lastOtpSentAt,
    otpLockedUntil: user.otpLockedUntil,
  });

  if (!eligibility.canRequest) {
    return mapEligibilityToStatus(eligibility);
  }

  if (!options?.forceResend && hasActiveOtpCode(context.userId)) {
    return {
      sent: true,
      message: "A verification code has already been sent. Check your server logs in development.",
    };
  }

  const otp = generateOtpCode();
  const now = new Date();
  const sentUpdate = computeOtpSentUpdate(user.activationOtpSentCount, now);

  storeOtpCode(context.userId, otp, now);
  await updateUserOtpTracking(context.userId, {
    lastOtpSentAt: sentUpdate.lastOtpSentAt,
    activationOtpSentCount: sentUpdate.activationOtpSentCount,
  });

  logDevOtpCode(context.userId, context.serviceNumber, otp);
  logDevOtp(context.userId, context.serviceNumber);

  await logActivationAuditEvent({
    action: "activation_validation_success",
    userId: context.userId,
    serviceNumber: context.serviceNumber,
    metadata: { event: "otp_sent", provider: "development" },
  });

  return {
    sent: true,
    message:
      process.env.NODE_ENV === "development"
        ? "Verification code sent. Check the server terminal for the OTP."
        : "Verification code sent to your registered phone number.",
  };
}

export async function ensureActivationOtp(
  context: ActivationContext,
): Promise<OtpDeliveryStatus> {
  return sendActivationOtp(context, { forceResend: false });
}

export type OtpVerificationResult =
  | { success: true }
  | {
      success: false;
      error: string;
      retryAfterSeconds?: number;
      lockedUntil?: string;
      isLocked?: boolean;
    };

export async function verifyActivationOtp(
  context: ActivationContext,
  otp: string,
): Promise<OtpVerificationResult> {
  const user = await findUserById(context.userId);

  if (!user) {
    return { success: false, error: "Member record not found." };
  }

  if (isOtpLocked(user.otpLockedUntil)) {
    return {
      success: false,
      error:
        "Too many failed attempts. OTP verification is temporarily locked.",
      isLocked: true,
      lockedUntil: user.otpLockedUntil
        ? new Date(
            typeof user.otpLockedUntil === "object" &&
              user.otpLockedUntil !== null &&
              "toDate" in user.otpLockedUntil
              ? (user.otpLockedUntil as { toDate(): Date }).toDate()
              : user.otpLockedUntil as unknown as Date,
          ).toISOString()
        : undefined,
    };
  }

  const isValid = verifyOtpCode(context.userId, otp);

  if (!isValid) {
    const failedUpdate = computeOtpFailedAttemptUpdate(user.otpAttempts);

    await updateUserOtpTracking(context.userId, {
      otpAttempts: failedUpdate.otpAttempts,
      otpLockedUntil: failedUpdate.otpLockedUntil,
    });

    await logActivationAuditEvent({
      action: "activation_validation_failure",
      userId: context.userId,
      serviceNumber: context.serviceNumber,
      metadata: {
        event: "otp_verification_failed",
        isLocked: failedUpdate.isLocked,
      },
    });

    if (failedUpdate.isLocked) {
      clearOtpCode(context.userId);
      return {
        success: false,
        error:
          "Too many failed attempts. OTP verification is locked for 15 minutes.",
        isLocked: true,
        lockedUntil: failedUpdate.otpLockedUntil?.toISOString(),
      };
    }

    return {
      success: false,
      error: "Invalid or expired verification code. Please try again.",
    };
  }

  const reset = computeOtpSuccessReset();
  await updateUserOtpTracking(context.userId, {
    otpAttempts: reset.otpAttempts,
    otpLockedUntil: reset.otpLockedUntil,
  });

  clearOtpCode(context.userId);
  await updateActivationContext({ ...context, step: "password" });

  await logActivationAuditEvent({
    action: "activation_validation_success",
    userId: context.userId,
    serviceNumber: context.serviceNumber,
    metadata: { event: "otp_verification_success" },
  });

  return { success: true };
}
