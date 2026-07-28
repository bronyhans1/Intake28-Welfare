import { describe, expect, it } from "vitest";
import { PORTAL_FAVICON_PATH, PORTAL_LOGO_PATH } from "@/lib/branding/assets";

describe("branding assets", () => {
  it("uses stable public asset paths for logo and favicon replacement", () => {
    expect(PORTAL_LOGO_PATH).toBe("/images/logo.png");
    expect(PORTAL_FAVICON_PATH).toBe("/favicon.ico");
  });
});
