import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import {
  findUserById,
  findUserByServiceNumber,
} from "@/lib/activation/repository";
import { COLLECTIONS } from "@/lib/constants";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/constants/password-reset";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { evaluatePasswordResetEligibility } from "@/lib/password-reset/eligibility";
import { PasswordResetAuditAction } from "@/lib/password-reset/audit";
import {
  getDefaultPasswordResetOtpFields,
} from "@/lib/utils/password-reset-otp";
import { phoneNumbersMatch } from "@/lib/utils/phone";
import { activationRequestSchema } from "@/lib/validators/activation";
import { formatServiceNumber } from "@/lib/utils/service-number";
import type { PasswordResetContext } from "@/types/password-reset";
import type { User } from "@/types/user";

export interface PasswordResetOtpTrackingUpdate {
  passwordResetOtp?: string | null;
  passwordResetOtpExpiresAt?: Date | null;
  passwordResetOtpAttempts?: number;
  passwordResetRequestedAt?: Date | null;
  passwordResetLockedUntil?: Date | null;
  passwordResetLastOtpSentAt?: Date | null;
}

function buildSelfServiceAuditActor(
  user: Pick<User, "id" | "fullName" | "role">,
) {
  return {
    performedBy: user.id,
    performedByRole: user.role,
    actorId: user.id,
    actorName: user.fullName,
    role: user.role,
  };
}

export async function findUserForPasswordReset(
  serviceNumber: string,
  phoneNumber: string,
): Promise<User | null> {
  const user = await findUserByServiceNumber(serviceNumber);

  if (!user) {
    return null;
  }

  if (!phoneNumbersMatch(user.phoneNumber, phoneNumber)) {
    return null;
  }

  return user;
}

export async function updatePasswordResetOtpTracking(
  userId: string,
  update: PasswordResetOtpTrackingUpdate,
): Promise<void> {
  const db = getAdminDb();
  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  const dateFields: Array<
    keyof Pick<
      PasswordResetOtpTrackingUpdate,
      | "passwordResetOtpExpiresAt"
      | "passwordResetRequestedAt"
      | "passwordResetLockedUntil"
      | "passwordResetLastOtpSentAt"
    >
  > = [
    "passwordResetOtpExpiresAt",
    "passwordResetRequestedAt",
    "passwordResetLockedUntil",
    "passwordResetLastOtpSentAt",
  ];

  for (const field of dateFields) {
    if (update[field] !== undefined) {
      payload[field] = update[field]
        ? Timestamp.fromDate(update[field] as Date)
        : null;
    }
  }

  if (update.passwordResetOtp !== undefined) {
    payload.passwordResetOtp = update.passwordResetOtp;
  }

  if (update.passwordResetOtpAttempts !== undefined) {
    payload.passwordResetOtpAttempts = update.passwordResetOtpAttempts;
  }

  await db.collection(COLLECTIONS.USERS).doc(userId).update(payload);
}

export async function clearPasswordResetOtpFields(userId: string): Promise<void> {
  await updatePasswordResetOtpTracking(userId, {
    ...getDefaultPasswordResetOtpFields(),
  });
}

export async function requestPasswordReset(
  input: unknown,
): Promise<
  | {
      success: false;
      error: string;
      fieldErrors?: Partial<
        Record<"serviceNumberSuffix" | "phoneNumber", string[]>
      >;
    }
  | {
      success: true;
      matched: boolean;
      message: string;
      context?: PasswordResetContext;
    }
> {
  const parsed = activationRequestSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      success: false,
      error: "Please correct the errors below.",
      fieldErrors: {
        serviceNumberSuffix: fieldErrors.serviceNumberSuffix,
        phoneNumber: fieldErrors.phoneNumber,
      },
    };
  }

  const serviceNumber = formatServiceNumber(parsed.data.serviceNumberSuffix);
  const phoneNumber = parsed.data.phoneNumber;

  const user = await findUserForPasswordReset(serviceNumber, phoneNumber);
  const eligibility = user ? evaluatePasswordResetEligibility(user) : null;

  if (!user || !eligibility?.eligible) {
    return {
      success: true,
      matched: false,
      message: PASSWORD_RESET_GENERIC_MESSAGE,
    };
  }

  const context: PasswordResetContext = {
    userId: user.id,
    serviceNumber,
    phoneNumber,
    step: "otp",
  };

  await createAuditLog({
    action: PasswordResetAuditAction.PASSWORD_RESET_REQUESTED,
    entityType: "user",
    entityId: user.id,
    ...buildSelfServiceAuditActor(user),
    metadata: {
      serviceNumber,
      fullName: user.fullName,
    },
  });

  return {
    success: true,
    matched: true,
    message: PASSWORD_RESET_GENERIC_MESSAGE,
    context,
  };
}

export async function resetPassword(
  context: PasswordResetContext,
  password: string,
): Promise<void> {
  const user = await findUserById(context.userId);

  if (!user) {
    throw new Error("Member record not found.");
  }

  const eligibility = evaluatePasswordResetEligibility(user);
  if (!eligibility.eligible) {
    throw new Error("Account is not eligible for password reset.");
  }

  const auth = getAdminAuth();
  await auth.updateUser(context.userId, { password });

  await clearPasswordResetOtpFields(context.userId);

  await createAuditLog({
    action: PasswordResetAuditAction.PASSWORD_RESET_COMPLETED,
    entityType: "user",
    entityId: user.id,
    ...buildSelfServiceAuditActor(user),
    metadata: {
      serviceNumber: context.serviceNumber,
      fullName: user.fullName,
    },
  });
}

export { verifyPasswordResetOtp } from "@/lib/password-reset/otp-service";
