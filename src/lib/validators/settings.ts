import { z } from "zod";
import { isValidWhatsAppCommunityUrl } from "@/lib/system-settings/whatsapp";
import { SettingsCurrency } from "@/types/enums";

function parseBooleanFormValue(value: unknown): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") {
    return true;
  }
  return false;
}

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
  whatsappCommunityEnabled: z.preprocess(
    (value) => parseBooleanFormValue(value),
    z.boolean(),
  ),
  whatsappCommunityUrl: z.preprocess(
    (value) => (value == null ? "" : value),
    z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        if (!value) return;
        if (!isValidWhatsAppCommunityUrl(value)) {
          ctx.addIssue({
            code: "custom",
            message:
              "Enter a valid HTTPS WhatsApp invite or community URL (chat.whatsapp.com or wa.me)",
          });
        }
      }),
  ),
});
export type UpdateSystemSettingsInput = z.infer<typeof updateSystemSettingsSchema>;
