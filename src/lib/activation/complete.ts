import { getActivationAuthEmail } from "@/lib/activation/auth-email";
import {
  activateUserRecord,
  findUserById,
} from "@/lib/activation/repository";
import { clearOtpCode } from "@/lib/activation/otp-store";
import { getAdminAuth } from "@/lib/firebase/admin";
import { ActivationStatus } from "@/types/enums";
import {
  deriveProfileCompletionSnapshot,
  toProfileCompletionContext,
} from "@/lib/utils/profile-completion";
import { evaluateActivationEligibility } from "@/lib/activation/eligibility";

function isAuthUserNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "auth/user-not-found"
  );
}

/**
 * Ensures a Firebase Auth account exists for the member UID.
 * First activation → createUser.
 * Re-activation after reset → updateUser (never create a second UID).
 */
export async function createFirebaseAuthAccount(
  userId: string,
  serviceNumber: string,
  password: string,
  displayName: string,
): Promise<"created" | "updated"> {
  const auth = getAdminAuth();
  const email = getActivationAuthEmail(serviceNumber);
  const profile = {
    email,
    password,
    displayName,
    disabled: false,
  };

  try {
    await auth.getUser(userId);
    await auth.updateUser(userId, profile);
    return "updated";
  } catch (error) {
    if (!isAuthUserNotFound(error)) {
      throw error;
    }

    await auth.createUser({
      uid: userId,
      ...profile,
    });
    return "created";
  }
}

/**
 * Soft-disables the Auth account when present.
 * Missing Auth users are ignored (never-activated members).
 */
export async function disableFirebaseAuthAccountIfExists(
  userId: string,
): Promise<boolean> {
  const auth = getAdminAuth();

  try {
    await auth.getUser(userId);
    await auth.updateUser(userId, { disabled: true });
    return true;
  } catch (error) {
    if (isAuthUserNotFound(error)) {
      return false;
    }
    throw error;
  }
}

export async function completeMemberActivation(
  userId: string,
  password: string,
): Promise<void> {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Member record not found.");
  }

  const eligibility = evaluateActivationEligibility(user);
  if (!eligibility.eligible) {
    throw new Error(eligibility.message ?? "Account is not eligible for activation.");
  }

  const profileSnapshot = deriveProfileCompletionSnapshot(
    toProfileCompletionContext({
      ...user,
      activationStatus: ActivationStatus.ACTIVATED,
    }),
  );

  await createFirebaseAuthAccount(
    user.id,
    user.serviceNumber,
    password,
    user.fullName,
  );

  await activateUserRecord(user.id, profileSnapshot);
  clearOtpCode(user.id);
}
