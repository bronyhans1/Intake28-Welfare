import { describe, expect, it } from "vitest";
import { updateSystemSettingsSchema } from "@/lib/validators/settings";
import { SettingsCurrency } from "@/types/enums";

const validBase = {
  organizationName: "GIS Intake 28 Welfare Association",
  portalName: "GIS Intake 28 Welfare Portal",
  monthlyDuesAmount: 50,
  currency: SettingsCurrency.GHS,
  defaultAnnouncementExpiryDays: 30,
  whatsappCommunityEnabled: false,
  whatsappCommunityUrl: "",
};

describe("updateSystemSettingsSchema", () => {
  it("accepts empty support email", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supportEmail).toBe("");
    }
  });

  it("accepts valid support email when provided", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "support@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid support email when provided", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("requires organization and portal names", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      organizationName: "",
      portalName: "",
      supportEmail: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts blank WhatsApp URL and disabled toggle", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "",
      whatsappCommunityEnabled: "false",
      whatsappCommunityUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsappCommunityEnabled).toBe(false);
      expect(result.data.whatsappCommunityUrl).toBe("");
    }
  });

  it("accepts enabled toggle with a valid WhatsApp invite URL", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "",
      whatsappCommunityEnabled: "true",
      whatsappCommunityUrl: "https://chat.whatsapp.com/AbCdEfGhIjK",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.whatsappCommunityEnabled).toBe(true);
    }
  });

  it("rejects invalid WhatsApp URLs when provided", () => {
    const result = updateSystemSettingsSchema.safeParse({
      ...validBase,
      supportEmail: "",
      whatsappCommunityEnabled: true,
      whatsappCommunityUrl: "https://example.com/group",
    });

    expect(result.success).toBe(false);
  });
});
