import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendOtpSms, verifyOtp } from "@/lib/notifications/otp-sms";
import {
  generatePhoneVerificationOtpCode,
  hashPhoneVerificationOtp,
} from "@/lib/phone-verification/otp";

const mockSendHubtelSms = vi.fn();

vi.mock("@/lib/integrations/hubtel/sms", () => ({
  sendHubtelSms: (...args: unknown[]) => mockSendHubtelSms(...args),
}));

describe("otp sms abstraction", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    process.env.ACTIVATION_SESSION_SECRET =
      "test-secret-with-at-least-32-characters-long";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns dev code in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const result = await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      verificationId: "verify-1",
      purpose: "phone_verification",
    });

    expect(result.sent).toBe(true);
    expect(result.provider).toBe("development");
    expect(result.devCode).toBe("654321");
    expect(mockSendHubtelSms).not.toHaveBeenCalled();
  });

  it("uses flow-aware expiry in Hubtel message for activation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GIS";

    mockSendHubtelSms.mockResolvedValue({ sent: true, messageId: "msg-1" });

    await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      purpose: "activation",
    });

    expect(mockSendHubtelSms).toHaveBeenCalledWith(
      "0241234567",
      "Your GIS Welfare verification code is 654321. Valid for 10 minutes.",
    );
  });

  it("uses flow-aware expiry in Hubtel message for phone verification", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GIS";

    mockSendHubtelSms.mockResolvedValue({ sent: true, messageId: "msg-1" });

    await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      purpose: "phone_verification",
    });

    expect(mockSendHubtelSms).toHaveBeenCalledWith(
      "0241234567",
      "Your GIS Welfare verification code is 654321. Valid for 5 minutes.",
    );
  });

  it("fails in production when Hubtel is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.HUBTEL_CLIENT_ID;
    delete process.env.HUBTEL_CLIENT_SECRET;
    delete process.env.HUBTEL_SENDER_ID;

    const result = await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      purpose: "activation",
    });

    expect(result.sent).toBe(false);
    expect(result.message).toContain("Unable to send");
    expect(mockSendHubtelSms).not.toHaveBeenCalled();
  });

  it("fails in production when Hubtel returns an error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GIS";

    mockSendHubtelSms.mockResolvedValue({ sent: false, error: "http_500" });

    const result = await sendOtpSms("0241234567", "654321", {
      memberId: "member-1",
      serviceNumber: "IS/001",
      purpose: "password_reset",
    });

    expect(result.sent).toBe(false);
    expect(result.message).toContain("Unable to send");
  });

  it("verifies OTP via abstraction", () => {
    const verificationId = "verify-abc";
    const code = generatePhoneVerificationOtpCode();
    const hash = hashPhoneVerificationOtp(verificationId, code);

    expect(verifyOtp(verificationId, code, hash)).toBe(true);
    expect(verifyOtp(verificationId, "000000", hash)).toBe(false);
  });
});
