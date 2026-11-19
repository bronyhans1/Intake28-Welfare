import { z } from "zod";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { isValidServiceNumberSuffix } from "@/lib/utils/service-number";

export const activationRequestSchema = z.object({
  serviceNumberSuffix: z
    .string()
    .min(1, "Service number is required")
    .refine(isValidServiceNumberSuffix, {
      message: "Enter digits only (e.g. 13984)",
    }),
  phoneNumber: z
    .string()
    .min(1, "Phone number is required")
    .transform(normalizePhoneNumber)
    .pipe(
      z
        .string()
        .regex(
          /^0\d{9}$/,
          "Enter a valid Ghana phone number (e.g. 024XXXXXXX)",
        ),
    ),
});

export type ActivationRequestInput = z.infer<typeof activationRequestSchema>;

export const otpVerificationSchema = z.object({
  otp: z
    .string()
    .min(1, "OTP is required")
    .regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
