import { describe, expect, it } from "vitest";
import { phoneChangeRequestSchema, phoneVerificationOtpSchema } from "@/lib/validators/phone-verification";

describe("phone verification validators", () => {
  it("accepts valid Ghana phone numbers", () => {
    const result = phoneChangeRequestSchema.safeParse({ newPhone: "0241234567" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    const result = phoneChangeRequestSchema.safeParse({ newPhone: "123" });
    expect(result.success).toBe(false);
  });

  it("requires a 6-digit OTP", () => {
    const result = phoneVerificationOtpSchema.safeParse({
      verificationId: "abc",
      otp: "12",
    });
    expect(result.success).toBe(false);

    const valid = phoneVerificationOtpSchema.safeParse({
      verificationId: "abc",
      otp: "123456",
    });
    expect(valid.success).toBe(true);
  });
});
