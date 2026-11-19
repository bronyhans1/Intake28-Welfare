import { describe, expect, it } from "vitest";
import { Gender } from "@/types/enums";
import {
  createMemberSchema,
  updateMemberSchema,
} from "@/lib/validators/member";

describe("member gender validation", () => {
  it("allows create member without gender", () => {
    const result = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      role: "member",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBeUndefined();
    }
  });

  it("accepts male and female on create", () => {
    const male = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      role: "member",
      gender: Gender.MALE,
    });
    const female = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      role: "member",
      gender: Gender.FEMALE,
    });

    expect(male.success).toBe(true);
    expect(female.success).toBe(true);
    if (male.success && female.success) {
      expect(male.data.gender).toBe("male");
      expect(female.data.gender).toBe("female");
    }
  });

  it("rejects invalid gender values", () => {
    const result = createMemberSchema.safeParse({
      serviceNumberSuffix: "13986",
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      role: "member",
      gender: "other",
    });

    expect(result.success).toBe(false);
  });

  it("allows update member gender changes", () => {
    const result = updateMemberSchema.safeParse({
      fullName: "Jane Doe",
      phoneNumber: "0241111111",
      dateOfBirth: "1990-01-01",
      rank: "Inspector",
      station: "HQ",
      role: "member",
      status: "active",
      gender: Gender.FEMALE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("female");
    }
  });
});
