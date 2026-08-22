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
import { sendOtpSms } from "@/lib/notifications/otp-sms";
import {
  computeOtpFailedAttemptUpdate,
  computeOtpSentUpdate,
  computeOtpSuccessReset,
  evaluateOtpRequestEligibility,
  isOtpLocked,
} from "@/lib/utils/activation-otp";
import type { ActivationContext, OtpDeliveryStatus } from "@/types/activation";

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

  if (!options?.forceResend && (await hasActiveOtpCode(context.userId))) {
    return {
      sent: true,
      message:
        process.env.NODE_ENV === "development"
          ? "A verification code has already been sent. Check your server terminal for the OTP."
          : "A verification code has already been sent to your registered phone number.",
    };
  }

  const otp = generateOtpCode();
  const now = new Date();
  const sentUpdate = computeOtpSentUpdate(user.activationOtpSentCount, now);

  await storeOtpCode(context.userId, otp, now);
  await updateUserOtpTracking(context.userId, {
    lastOtpSentAt: sentUpdate.lastOtpSentAt,
    activationOtpSentCount: sentUpdate.activationOtpSentCount,
  });

  const smsResult = await sendOtpSms(context.phoneNumber, otp, {
    memberId: context.userId,
    serviceNumber: context.serviceNumber,
    purpose: "activation",
  });

  if (!smsResult.sent) {
    return {
      sent: false,
      message:
        smsResult.message ??
        "Unable to send verification code. Please try again later.",
    };
  }

  await logActivationAuditEvent({
    action: "activation_validation_success",
    userId: context.userId,
    serviceNumber: context.serviceNumber,
    metadata: {
      event: "otp_sent",
      provider: smsResult.provider,
    },
  });

  return {
    sent: true,
    message: smsResult.message,
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
              : (user.otpLockedUntil as unknown as Date),
          ).toISOString()
        : undefined,
    };
  }

  const isValid = await verifyOtpCode(context.userId, otp);

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
      await clearOtpCode(context.userId);
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

  await clearOtpCode(context.userId);
  await updateActivationContext({ ...context, step: "password" });

  await logActivationAuditEvent({
    action: "activation_validation_success",
    userId: context.userId,
    serviceNumber: context.serviceNumber,
    metadata: { event: "otp_verification_success" },
  });

  return { success: true };
}
