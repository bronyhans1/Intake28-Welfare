import { isHubtelConfigured } from "@/lib/integrations/hubtel/config";
import { sendHubtelSms } from "@/lib/integrations/hubtel/sms";
import { verifyPhoneVerificationOtpHash } from "@/lib/phone-verification/otp";

export interface OtpSmsContext {
  memberId: string;
  serviceNumber: string;
  verificationId?: string;
}

export interface OtpSmsSendResult {
  sent: boolean;
  provider: "development" | "hubtel";
  message?: string;
  /** Plain OTP returned only in development for test banners */
  devCode?: string;
}

function logDevOtpCode(context: OtpSmsContext, phone: string, code: string): void {
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[phone-verification:otp:dev] OTP for ${context.serviceNumber} (memberId=${context.memberId}, phone=${phone}): ${code}`,
    );
  }
}

function buildOtpMessage(code: string): string {
  return `Your GIS Welfare verification code is ${code}. Valid for 5 minutes.`;
}

/**
 * Sends an OTP SMS via Hubtel in production when configured, otherwise mock/dev mode.
 */
export async function sendOtpSms(
  phone: string,
  code: string,
  context: OtpSmsContext,
): Promise<OtpSmsSendResult> {
  const useHubtel =
    process.env.NODE_ENV === "production" && isHubtelConfigured();

  if (useHubtel) {
    await sendHubtelSms(phone, buildOtpMessage(code));
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
    devCode: process.env.NODE_ENV === "development" ? code : undefined,
    message:
      process.env.NODE_ENV === "development"
        ? "Verification code sent. Check the server terminal or test banner for the OTP."
        : "Verification code sent.",
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
