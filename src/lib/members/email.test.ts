import { describe, expect, it } from "vitest";
import {
  DUPLICATE_EMAIL_ERROR,
  isValidMemberEmail,
  normalizeMemberEmail,
  resolveMemberEmailInput,
} from "@/lib/members/email";

describe("member email helpers", () => {
  it("normalizes and lowercases email values", () => {
    expect(normalizeMemberEmail(" Mary@Gmail.COM ")).toBe("mary@gmail.com");
    expect(normalizeMemberEmail("")).toBeNull();
  });

  it("validates email format", () => {
    expect(isValidMemberEmail("mary@gmail.com")).toBe(true);
    expect(isValidMemberEmail("invalid-email")).toBe(false);
  });

  it("allows blank email input", () => {
    expect(resolveMemberEmailInput("")).toBeNull();
    expect(resolveMemberEmailInput(undefined)).toBeNull();
  });

  it("rejects invalid email input", () => {
    expect(() => resolveMemberEmailInput("not-an-email")).toThrow(
      "Enter a valid email address.",
    );
  });

  it("exports duplicate email error message", () => {
    expect(DUPLICATE_EMAIL_ERROR).toBe(
      "A member with this email address already exists.",
    );
  });
});
