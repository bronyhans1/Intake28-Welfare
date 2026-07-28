import { z } from "zod";
import { SettingsCurrency } from "@/types/enums";

export const updateSystemSettingsSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required"),
  portalName: z.string().trim().min(1, "Portal name is required"),
  supportEmail: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) return;
      if (!z.string().email().safeParse(value).success) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid support email",
        });
      }
    }),
  supportPhone: z.string().trim().optional(),
  monthlyDuesAmount: z.coerce
    .number()
    .min(1, "Monthly dues amount must be at least 1"),
  currency: z.enum([SettingsCurrency.GHS]),
  defaultAnnouncementExpiryDays: z.coerce
    .number()
    .min(1, "Default announcement expiry must be at least 1 day"),
});

export type UpdateSystemSettingsInput = z.infer<typeof updateSystemSettingsSchema>;
