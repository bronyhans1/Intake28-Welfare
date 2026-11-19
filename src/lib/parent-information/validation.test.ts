import { describe, expect, it } from "vitest";
import {
  addParentInformationLockDays,
  isParentInformationLocked,
  validateParentInformationInput,
} from "@/lib/parent-information/validation";

describe("validateParentInformationInput", () => {
  it("rejects completely empty submissions", () => {
    const result = validateParentInformationInput({
      motherFullName: "",
      motherStatus: "",
      fatherFullName: "",
      fatherStatus: "",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/both mother and father/i);
  });

  it("requires name when status is selected", () => {
    const result = validateParentInformationInput({
      motherFullName: "",
      motherStatus: "alive",
      fatherFullName: "John Doe",
      fatherStatus: "deceased",
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.motherFullName).toMatch(/required/i);
  });

  it("requires status when name is entered", () => {
    const result = validateParentInformationInput({
      motherFullName: "Jane Doe",
      motherStatus: "",
      fatherFullName: "John Doe",
      fatherStatus: "alive",
    });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.motherStatus).toMatch(/Alive or Deceased/i);
  });

  it("accepts complete mother and father details", () => {
    const result = validateParentInformationInput({
      motherFullName: " Jane Doe ",
      motherStatus: "alive",
      fatherFullName: "John Doe",
      fatherStatus: "deceased",
    });

    expect(result.success).toBe(true);
    expect(result.values).toEqual({
      motherFullName: "Jane Doe",
      motherStatus: "alive",
      fatherFullName: "John Doe",
      fatherStatus: "deceased",
    });
  });
});

describe("parent information lock helpers", () => {
  it("adds 365 days to the lock timestamp", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const lockedUntil = addParentInformationLockDays(from);
    expect(lockedUntil.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("treats completed records as locked before expiry", () => {
    const locked = isParentInformationLocked(
      {
        parentInformationCompleted: true,
        parentInformationLockedUntil: "2099-01-01T00:00:00.000Z",
      },
      new Date("2026-07-25T00:00:00.000Z"),
    );
    expect(locked).toBe(true);
  });

  it("unlocks after the lock date", () => {
    const locked = isParentInformationLocked(
      {
        parentInformationCompleted: true,
        parentInformationLockedUntil: "2025-01-01T00:00:00.000Z",
      },
      new Date("2026-07-25T00:00:00.000Z"),
    );
    expect(locked).toBe(false);
  });
});
