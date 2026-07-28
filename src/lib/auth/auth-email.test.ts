import { describe, expect, it } from "vitest";
import { getAuthEmailFromServiceNumber } from "@/lib/auth/auth-email";
import { parseServiceNumberSuffix, formatServiceNumber } from "@/lib/utils/service-number";

describe("service number normalization for login", () => {
  it("normalizes suffix-only input", () => {
    expect(parseServiceNumberSuffix("13984")).toBe("13984");
    expect(formatServiceNumber("13984")).toBe("IS/13984");
  });

  it("normalizes full service number input", () => {
    expect(parseServiceNumberSuffix("IS/13984")).toBe("13984");
    expect(parseServiceNumberSuffix("is/13984")).toBe("13984");
  });

  it("generates auth email from either format", () => {
    expect(getAuthEmailFromServiceNumber("13984")).toBe(
      "IS13984@giswelfare.local",
    );
    expect(getAuthEmailFromServiceNumber("IS/13984")).toBe(
      "IS13984@giswelfare.local",
    );
  });
});
