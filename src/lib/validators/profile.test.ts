import { describe, expect, it } from "vitest";
import { Gender } from "@/types/enums";
import { updateProfileSchema } from "@/lib/validators/profile";

describe("updateProfileSchema", () => {
  const validInput = {
    email: "mary@gmail.com",
    dateOfBirth: "1990-01-01",
    gender: Gender.MALE,
    rank: "Inspector",
    station: "HQ",
    nextOfKin: "Jane Doe",
    emergencyContact: "0249999999",
  };

  it("accepts valid member profile updates", () => {
    const result = updateProfileSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("allows blank email", () => {
    const result = updateProfileSchema.safeParse({
      ...validInput,
      email: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("");
    }
  });

  it("rejects invalid email", () => {
    const result = updateProfileSchema.safeParse({
      ...validInput,
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
  });

  it("requires rank and station", () => {
    const result = updateProfileSchema.safeParse({
      ...validInput,
      rank: "",
    });

    expect(result.success).toBe(false);
  });
});
