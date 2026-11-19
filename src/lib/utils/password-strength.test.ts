import { describe, expect, it } from "vitest";
import {
  formatCooldownTimer,
  getPasswordRequirements,
  getPasswordStrength,
} from "@/lib/utils/password-strength";

describe("getPasswordRequirements", () => {
  it("detects all requirements for a valid password", () => {
    expect(getPasswordRequirements("Secret1a")).toEqual({
      minLength: true,
      uppercase: true,
      lowercase: true,
      number: true,
    });
  });

  it("detects missing requirements", () => {
    expect(getPasswordRequirements("sec")).toEqual({
      minLength: false,
      uppercase: false,
      lowercase: true,
      number: false,
    });
  });
});

describe("getPasswordStrength", () => {
  it("returns weak for empty or partial passwords", () => {
    expect(getPasswordStrength("")).toBe("weak");
    expect(getPasswordStrength("abc")).toBe("weak");
  });

  it("returns medium when most requirements are met", () => {
    expect(getPasswordStrength("Secret1a")).toBe("medium");
  });

  it("returns strong for longer passwords meeting all rules", () => {
    expect(getPasswordStrength("SecretPassword1")).toBe("strong");
  });
});

describe("formatCooldownTimer", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatCooldownTimer(90)).toBe("01:30");
    expect(formatCooldownTimer(5)).toBe("00:05");
    expect(formatCooldownTimer(0)).toBe("00:00");
  });
});
