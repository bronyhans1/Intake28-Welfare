"use server";

import { clearAuthSession, establishAuthSession, syncAuthRoleCookie } from "@/lib/auth/session";
import type { EstablishSessionResult } from "@/types/auth";
import type { UserRole } from "@/types/enums";

export async function createAuthSession(
  idToken: string,
): Promise<EstablishSessionResult> {
  return establishAuthSession(idToken);
}

export async function destroyAuthSession(): Promise<void> {
  await clearAuthSession();
}

/** Keeps the role cookie aligned with the authoritative Firestore role. */
export async function syncSessionRoleAction(role: UserRole): Promise<void> {
  await syncAuthRoleCookie(role);
}
