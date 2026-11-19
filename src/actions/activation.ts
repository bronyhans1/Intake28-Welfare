"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { logActivationAuditEvent } from "@/lib/activation/audit";
import { evaluateActivationEligibility } from "@/lib/activation/eligibility";
import { findUserForActivation } from "@/lib/activation/repository";
import { setActivationContext } from "@/lib/activation/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { activationRequestSchema } from "@/lib/validators/activation";
import { formatServiceNumber } from "@/lib/utils/service-number";
import type {
  ActivationActionState,
  ActivationContext,
  ActivationValidationResult,
} from "@/types/activation";

export async function validateActivationRequest(
  input: unknown,
): Promise<ActivationValidationResult> {
  const parsed = activationRequestSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      success: false,
      code: "INVALID_INPUT",
      error: "Please correct the errors below.",
      fieldErrors: {
        serviceNumberSuffix: fieldErrors.serviceNumberSuffix,
        phoneNumber: fieldErrors.phoneNumber,
      },
    };
  }

  if (!isFirebaseAdminConfigured()) {
    return {
      success: false,
      code: "SERVER_ERROR",
      error: "Activation is temporarily unavailable. Please try again later.",
    };
  }

  const serviceNumber = formatServiceNumber(parsed.data.serviceNumberSuffix);
  const phoneNumber = parsed.data.phoneNumber;

  try {
    const user = await findUserForActivation(serviceNumber, phoneNumber);

    if (!user) {
      await logActivationAuditEvent({
        action: "activation_validation_failure",
        serviceNumber,
        code: "NOT_FOUND",
        metadata: { reason: "credentials_mismatch" },
      });

      return {
        success: false,
        code: "NOT_FOUND",
        error:
          "Invalid service number or phone number. Please check your details and try again.",
      };
    }

    const eligibility = evaluateActivationEligibility(user);

    if (!eligibility.eligible) {
      await logActivationAuditEvent({
        action: "activation_validation_failure",
        userId: user.id,
        serviceNumber,
        code: eligibility.code,
      });

      return {
        success: false,
        code: eligibility.code ?? "NOT_ELIGIBLE",
        error:
          eligibility.message ??
          "Your account is not eligible for activation.",
      };
    }

    const context: ActivationContext = {
      userId: user.id,
      serviceNumber,
      phoneNumber,
      step: "otp",
    };

    await logActivationAuditEvent({
      action: "activation_validation_success",
      userId: user.id,
      serviceNumber,
    });

    return { success: true, context };
  } catch {
    return {
      success: false,
      code: "SERVER_ERROR",
      error: "Unable to verify your details. Please try again later.",
    };
  }
}

export async function submitActivationRequest(
  input: unknown,
): Promise<ActivationActionState> {
  try {
    const result = await validateActivationRequest(input);

    if (!result.success) {
      return {
        error: result.error,
        fieldErrors: result.fieldErrors,
      };
    }

    await setActivationContext(result.context);
    redirect("/activate-account/verify");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      error: "Unable to process your request. Please try again later.",
    };
  }
}
