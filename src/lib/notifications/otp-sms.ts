import { ACTIVATION_OTP } from "@/lib/constants/activation-otp";
import { PHONE_VERIFICATION_OTP } from "@/lib/constants/phone-verification";
import { isHubtelConfigured } from "@/lib/integrations/hubtel/config";
import { sendHubtelSms } from "@/lib/integrations/hubtel/sms";
import { verifyPhoneVerificationOtpHash } from "@/lib/phone-verification/otp";

export type OtpSmsPurpose =
  | "activation"
  | "password_reset"
  | "phone_verification";

export interface OtpSmsContext {
  memberId: string;
  serviceNumber: string;
  verificationId?: string;
  purpose: OtpSmsPurpose;
}

export interface OtpSmsSendResult {
  sent: boolean;
  provider: "development" | "hubtel";
  message?: string;
  /** Plain OTP returned only in development for test banners */
  devCode?: string;
}

const SMS_UNAVAILABLE_MESSAGE =
  "Unable to send verification code. Please try again later.";

function logDevOtpCode(context: OtpSmsContext, phone: string, code: string): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[otp-sms:dev] OTP for ${context.serviceNumber} (memberId=${context.memberId}, purpose=${context.purpose}, phone=${phone}): ${code}`,
    );
  }
}

function getOtpExpiryMinutes(purpose: OtpSmsPurpose): number {
  if (purpose === "phone_verification") {
    return PHONE_VERIFICATION_OTP.CODE_EXPIRY_MINUTES;
  }

  return ACTIVATION_OTP.CODE_EXPIRY_MINUTES;
}

function buildOtpMessage(code: string, purpose: OtpSmsPurpose): string {
  const minutes = getOtpExpiryMinutes(purpose);
  return `Your GIS Welfare verification code is ${code}. Valid for ${minutes} minutes.`;
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Sends an OTP SMS via Hubtel in production when configured, otherwise mock/dev mode.
 */
export async function sendOtpSms(
  phone: string,
  code: string,
  context: OtpSmsContext,
): Promise<OtpSmsSendResult> {
  const message = buildOtpMessage(code, context.purpose);

  if (isProductionEnvironment()) {
    if (!isHubtelConfigured()) {
      console.error("[otp-sms] Hubtel not configured in production", {
        memberId: context.memberId,
        purpose: context.purpose,
      });
      return {
        sent: false,
        provider: "hubtel",
        message: SMS_UNAVAILABLE_MESSAGE,
      };
    }

    const hubtelResult = await sendHubtelSms(phone, message);
    if (!hubtelResult.sent) {
      console.error("[otp-sms] Hubtel send failed", {
        memberId: context.memberId,
        purpose: context.purpose,
        error: hubtelResult.error,
      });
      return {
        sent: false,
        provider: "hubtel",
        message: SMS_UNAVAILABLE_MESSAGE,
      };
    }

    return {
      sent: true,
      provider: "hubtel",
      message: "Verification code sent to your phone number.",
    };
  }

  logDevOtpCode(context, phone, code);

  return {
    sent: true,
    provider: "development",
    devCode: code,
    message:
      "Verification code sent. Check the server terminal or test banner for the OTP.",
  };
}

export function verifyOtp(
  verificationId: string,
  submittedCode: string,
  storedHash: string | null | undefined,
): boolean {
  return verifyPhoneVerificationOtpHash(
    verificationId,
    submittedCode,
    storedHash,
  );
}
