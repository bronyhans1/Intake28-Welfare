import { describe, expect, it } from "vitest";
import {
  AUTH_POWERED_BY,
  AUTH_SYSTEM_COPYRIGHT,
  AUTH_VERSION_LABEL,
} from "@/lib/branding/auth";
import { APP_VERSION, formatAppVersionLabel } from "@/lib/branding/version";

describe("auth branding", () => {
  it("defines GIS welfare branding copy and shared version", () => {
    expect(AUTH_SYSTEM_COPYRIGHT).toBe("© 2026 GIS WELFARE SYSTEM");
    expect(AUTH_POWERED_BY).toBe("Powered by Brony Hans");
    expect(AUTH_VERSION_LABEL).toBe(formatAppVersionLabel(APP_VERSION));
    expect(AUTH_VERSION_LABEL).toBe("Version 1.7.0");
  });
});
