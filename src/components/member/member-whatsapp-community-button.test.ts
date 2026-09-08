import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { shouldShowWhatsAppCommunityButton } from "@/lib/system-settings/whatsapp";

const buttonSource = readFileSync(
  join(process.cwd(), "src/components/member/member-whatsapp-community-button.tsx"),
  "utf8",
);

describe("MemberWhatsAppCommunityButton source contract", () => {
  it("uses safe external-link attributes and accessible labeling", () => {
    expect(buttonSource).toContain('target="_blank"');
    expect(buttonSource).toContain('rel="noopener noreferrer"');
    expect(buttonSource).toContain('aria-label="Join our WhatsApp Community"');
    expect(buttonSource).toContain("shouldShowWhatsAppCommunityButton");
    expect(buttonSource).toContain("normalizeWhatsAppCommunityUrl");
    expect(buttonSource).not.toContain("dangerouslySetInnerHTML");
  });

  it("is a fixed lower-right floating action button", () => {
    expect(buttonSource).toContain("fixed");
    expect(buttonSource).toMatch(/bottom-\d+/);
    expect(buttonSource).toMatch(/right-\d+/);
  });

  it("uses a CSS pulse class without changing link or visibility behavior", () => {
    expect(buttonSource).toContain("member-whatsapp-fab");
    const globalsCss = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(globalsCss).toContain("@keyframes member-whatsapp-fab-pulse");
    expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globalsCss).toContain(".member-whatsapp-fab::before");
  });
});

describe("member portal WhatsApp visibility (settings → button)", () => {
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

describe("member portal WhatsApp placement", () => {
  it("is mounted from the protected member layout, not admin or login", () => {
    const protectedLayout = readFileSync(
      join(process.cwd(), "src/app/(protected)/layout.tsx"),
      "utf8",
    );
    const adminLayout = readFileSync(
      join(process.cwd(), "src/components/admin/admin-layout.tsx"),
      "utf8",
    );

    expect(protectedLayout).toContain("MemberWhatsAppCommunityButton");
    expect(adminLayout).not.toContain("MemberWhatsAppCommunityButton");

    const loginCandidates = [
      "src/app/login/page.tsx",
      "src/app/(public)/login/page.tsx",
      "src/app/(auth)/login/page.tsx",
    ];
    for (const relative of loginCandidates) {
      const absolute = join(process.cwd(), relative);
      if (!existsSync(absolute)) continue;
      const loginSource = readFileSync(absolute, "utf8");
      expect(loginSource).not.toContain("MemberWhatsAppCommunityButton");
    }
  });
});
