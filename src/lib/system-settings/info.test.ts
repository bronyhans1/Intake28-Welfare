import { describe, expect, it } from "vitest";
import {
  APPLICATION_VERSION_LABEL,
  getSystemInformation,
} from "@/lib/system-settings/info";
import { APP_VERSION, formatAppVersionLabel } from "@/lib/branding/version";

describe("getSystemInformation", () => {
  it("returns simplified version and branding labels from APP_VERSION", () => {
    const info = getSystemInformation();

    expect(APP_VERSION).toBe("1.7.0");
    expect(info.versionLabel).toBe(APPLICATION_VERSION_LABEL);
    expect(info.versionLabel).toBe(formatAppVersionLabel());
    expect(info.versionLabel).toBe("Version 1.7.0");
    expect(info.poweredByLabel).toBe("Powered by Brony Hans");
  });
});
