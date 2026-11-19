import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";
import type { ActivationValidationErrorCode } from "@/types/activation";

export interface ActivationEligibilityResult {
  eligible: boolean;
  code?: ActivationValidationErrorCode;
  message?: string;
}

export function evaluateActivationEligibility(
  user: Pick<User, "activationStatus" | "status">,
): ActivationEligibilityResult {
  if (user.activationStatus === ActivationStatus.ACTIVATED) {
    return {
      eligible: false,
      code: "ALREADY_ACTIVATED",
      message:
        "This account has already been activated. Please sign in to continue.",
    };
  }

  if (user.status !== UserStatus.ACTIVE) {
    return {
      eligible: false,
      code: "NOT_ELIGIBLE",
      message:
        "Your account is not eligible for activation. Please contact your administrator.",
    };
  }

  if (user.activationStatus !== ActivationStatus.PENDING) {
    return {
      eligible: false,
      code: "NOT_ELIGIBLE",
      message:
        "Your account is not eligible for activation. Please contact your administrator.",
    };
  }

  return { eligible: true };
}
