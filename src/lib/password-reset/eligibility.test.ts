import { describe, expect, it } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";
import { evaluatePasswordResetEligibility } from "@/lib/password-reset/eligibility";

describe("evaluatePasswordResetEligibility", () => {
  it("allows activated active users", () => {
    expect(
      evaluatePasswordResetEligibility({
        activationStatus: ActivationStatus.ACTIVATED,
        status: UserStatus.ACTIVE,
      }),
    ).toEqual({ eligible: true });
  });

  it("rejects pending activation users", () => {
    expect(
      evaluatePasswordResetEligibility({
        activationStatus: ActivationStatus.PENDING,
        status: UserStatus.ACTIVE,
      }),
    ).toEqual({ eligible: false });
  });

  it("rejects inactive users", () => {
    expect(
      evaluatePasswordResetEligibility({
        activationStatus: ActivationStatus.ACTIVATED,
        status: UserStatus.SUSPENDED,
      }),
    ).toEqual({ eligible: false });
  });
});
