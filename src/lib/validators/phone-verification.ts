import { z } from "zod";
import { normalizePhoneNumber } from "@/lib/utils/phone";

const ghanaPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform(normalizePhoneNumber)
  .pipe(
    z.string().regex(/^0\d{9}$/, "Enter a valid Ghana phone number (e.g. 024XXXXXXX)"),
  );

export const phoneChangeRequestSchema = z.object({
  newPhone: ghanaPhoneSchema,
});

export const phoneVerificationOtpSchema = z.object({
  verificationId: z.string().min(1, "Verification session is required"),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export const phoneVerificationResendSchema = z.object({
  verificationId: z.string().min(1, "Verification session is required"),
});

export type PhoneChangeRequestInput = z.infer<typeof phoneChangeRequestSchema>;
export type PhoneVerificationOtpInput = z.infer<typeof phoneVerificationOtpSchema>;
export type PhoneVerificationResendInput = z.infer<typeof phoneVerificationResendSchema>;
