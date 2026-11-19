import { describe, expect, it } from "vitest";
import { activationPasswordSchema } from "@/lib/validators/password";

describe("activationPasswordSchema", () => {
  it("accepts a valid password", () => {
    const result = activationPasswordSchema.safeParse({
      password: "Secret1a",
      confirmPassword: "Secret1a",
    });

    expect(result.success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = activationPasswordSchema.safeParse({
      password: "Sec1a",
      confirmPassword: "Sec1a",
    });

    expect(result.success).toBe(false);
  });

  it("requires uppercase, lowercase, and number", () => {
    expect(
      activationPasswordSchema.safeParse({
        password: "secret123",
        confirmPassword: "secret123",
      }).success,
    ).toBe(false);

    expect(
      activationPasswordSchema.safeParse({
        password: "SECRET123",
        confirmPassword: "SECRET123",
      }).success,
    ).toBe(false);

    expect(
      activationPasswordSchema.safeParse({
        password: "Secretabc",
        confirmPassword: "Secretabc",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const result = activationPasswordSchema.safeParse({
      password: "Secret1a",
      confirmPassword: "Secret1b",
    });

    expect(result.success).toBe(false);
  });
});
