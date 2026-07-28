import { z } from "zod";
import { isValidServiceNumberSuffix } from "@/lib/utils/service-number";

export const loginSchema = z.object({
  serviceNumberSuffix: z
    .string()
    .min(1, "Service number is required")
    .refine(isValidServiceNumberSuffix, {
      message: "Enter digits only (e.g. 13984)",
    }),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
