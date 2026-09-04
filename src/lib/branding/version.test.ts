import { describe, expect, it } from "vitest";
import {
  APP_VERSION,
  APPLICATION_VERSION_LABEL,
  formatAppVersionLabel,
} from "@/lib/branding/version";

describe("application version", () => {
  it("exposes a single Version 1.7.5 source of truth", () => {
    expect(APP_VERSION).toBe("1.7.5");
    expect(formatAppVersionLabel()).toBe("Version 1.7.5");
    expect(APPLICATION_VERSION_LABEL).toBe("Version 1.7.5");
  });
});
