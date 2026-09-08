import { describe, expect, it } from "vitest";
import {
  isValidWhatsAppCommunityUrl,
  shouldShowWhatsAppCommunityButton,
} from "@/lib/system-settings/whatsapp";

describe("isValidWhatsAppCommunityUrl", () => {
  it("accepts HTTPS chat.whatsapp.com invite links", () => {
    expect(
      isValidWhatsAppCommunityUrl("https://chat.whatsapp.com/AbCdEfGhIjK"),
    ).toBe(true);
  });

  it("accepts HTTPS wa.me links", () => {
    expect(isValidWhatsAppCommunityUrl("https://wa.me/233201234567")).toBe(true);
  });

  it("rejects blank values", () => {
    expect(isValidWhatsAppCommunityUrl("")).toBe(false);
    expect(isValidWhatsAppCommunityUrl("   ")).toBe(false);
  });

  it("rejects non-HTTPS and non-WhatsApp hosts", () => {
    expect(isValidWhatsAppCommunityUrl("http://chat.whatsapp.com/abc")).toBe(
      false,
    );
    expect(isValidWhatsAppCommunityUrl("https://example.com/group")).toBe(false);
    expect(isValidWhatsAppCommunityUrl("not-a-url")).toBe(false);
  });
});

describe("shouldShowWhatsAppCommunityButton", () => {
  const validUrl = "https://chat.whatsapp.com/AbCdEfGhIjK";

  it("shows when enabled with a valid URL", () => {
    expect(
      shouldShowWhatsAppCommunityButton({
        whatsappCommunityEnabled: true,
        whatsappCommunityUrl: validUrl,
      }),
    ).toBe(true);
  });

  it("hides when disabled even with a valid URL", () => {
    expect(
      shouldShowWhatsAppCommunityButton({
        whatsappCommunityEnabled: false,
        whatsappCommunityUrl: validUrl,
      }),
    ).toBe(false);
  });

  it("hides when enabled with a blank URL", () => {
    expect(
      shouldShowWhatsAppCommunityButton({
        whatsappCommunityEnabled: true,
        whatsappCommunityUrl: "",
      }),
    ).toBe(false);
  });

  it("hides when enabled with an invalid URL", () => {
    expect(
      shouldShowWhatsAppCommunityButton({
        whatsappCommunityEnabled: true,
        whatsappCommunityUrl: "https://example.com/not-whatsapp",
      }),
    ).toBe(false);
  });
});
