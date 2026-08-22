import { describe, expect, it } from "vitest";
import {
  formatPhoneForHubtelSms,
  normalizePhoneNumber,
  phoneNumbersMatch,
} from "@/lib/utils/phone";

describe("phone utilities", () => {
  it("normalizes Ghana local numbers", () => {
    expect(normalizePhoneNumber("024 123 4567")).toBe("0241234567");
    expect(normalizePhoneNumber("+233241234567")).toBe("0241234567");
    expect(normalizePhoneNumber("233241234567")).toBe("0241234567");
  });

  it("formats stored numbers for Hubtel SMS", () => {
    expect(formatPhoneForHubtelSms("0241234567")).toBe("+233241234567");
    expect(formatPhoneForHubtelSms("233241234567")).toBe("+233241234567");
  });

  it("matches equivalent phone numbers", () => {
    expect(phoneNumbersMatch("0241234567", "+233241234567")).toBe(true);
  });
});
