import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";

export interface PasswordResetEligibilityResult {
  eligible: boolean;
}

export function evaluatePasswordResetEligibility(
  user: Pick<User, "activationStatus" | "status">,
): PasswordResetEligibilityResult {
  if (user.activationStatus !== ActivationStatus.ACTIVATED) {
    return { eligible: false };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return { eligible: false };
  }

  return { eligible: true };
}
