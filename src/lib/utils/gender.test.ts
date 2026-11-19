import { describe, expect, it } from "vitest";
import { Gender } from "@/types/enums";
import { formatGenderLabel, normalizeGender } from "./gender";

describe("normalizeGender", () => {
  it("accepts lowercase enum values", () => {
    expect(normalizeGender(Gender.MALE)).toBe("male");
    expect(normalizeGender(Gender.FEMALE)).toBe("female");
  });

  it("normalizes case-insensitive strings", () => {
    expect(normalizeGender("Male")).toBe("male");
    expect(normalizeGender(" FEMALE ")).toBe("female");
  });

  it("returns null for empty or invalid values", () => {
    expect(normalizeGender(undefined)).toBeNull();
    expect(normalizeGender(null)).toBeNull();
    expect(normalizeGender("")).toBeNull();
    expect(normalizeGender("other")).toBeNull();
  });
});

describe("formatGenderLabel", () => {
  it("formats stored gender values", () => {
    expect(formatGenderLabel("male")).toBe("Male");
    expect(formatGenderLabel("female")).toBe("Female");
    expect(formatGenderLabel(null)).toBe("—");
  });
});
