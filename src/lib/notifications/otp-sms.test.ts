import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendOtpSms, verifyOtp } from "@/lib/notifications/otp-sms";
import {
  generatePhoneVerificationOtpCode,
  hashPhoneVerificationOtp,
} from "@/lib/phone-verification/otp";

vi.mock("@/lib/integrations/hubtel/sms", () => ({
  sendHubtelSms: vi.fn(),
}));

describe("otp sms abstraction", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env.ACTIVATION_SESSION_SECRET =
      "test-secret-with-at-least-32-characters-long";
  });

  it("returns dev code in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const result = await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      verificationId: "verify-1",
    });

    expect(result.sent).toBe(true);
    expect(result.provider).toBe("development");
    expect(result.devCode).toBe("654321");
  });

  it("verifies OTP via abstraction", () => {
    const verificationId = "verify-abc";
    const code = generatePhoneVerificationOtpCode();
    const hash = hashPhoneVerificationOtp(verificationId, code);

    expect(verifyOtp(verificationId, code, hash)).toBe(true);
    expect(verifyOtp(verificationId, "000000", hash)).toBe(false);
  });
});
