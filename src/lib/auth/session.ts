import { cookies } from "next/headers";
import { findUserById } from "@/lib/activation/repository";
import {
  GENERIC_LOGIN_ERROR,
  getLoginRedirectPath,
  validateUserForLogin,
} from "@/lib/auth/login";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  AUTH_ROLE_COOKIE,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_MAX_AGE_SECONDS,
  type CurrentUser,
  type EstablishSessionResult,
} from "@/types/auth";
import type { UserRole } from "@/types/enums";
import type { User } from "@/types/user";

function mapToCurrentUser(user: User): CurrentUser {
  return {
    uid: user.id,
    fullName: user.fullName,
    serviceNumber: user.serviceNumber,
    role: user.role,
    profileCompleted: user.profileCompleted,
    profileCompletionPercentage: user.profileCompletionPercentage,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
    gender: user.gender ?? null,
  };
}

export async function setAuthRoleCookie(role: UserRole): Promise<void> {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(AUTH_ROLE_COOKIE, role, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  });
}

/** Syncs the role cookie when it differs from the authoritative Firestore role. */
export async function syncAuthRoleCookie(role: UserRole): Promise<boolean> {
  const cookieStore = await cookies();
  const currentRole = cookieStore.get(AUTH_ROLE_COOKIE)?.value;

  if (currentRole === role) {
    return false;
  }

  await setAuthRoleCookie(role);
  return true;
}

export async function establishAuthSession(
  idToken: string,
): Promise<EstablishSessionResult> {
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    if (decoded.firebase?.sign_in_provider === "password" && decoded.email_verified === false) {
      // GIS accounts use synthetic emails — no verification required
    }

    const user = await findUserById(decoded.uid);
    const validation = validateUserForLogin(user);

    if (!validation.valid || !user) {
      return {
        success: false,
        error: validation.error ?? GENERIC_LOGIN_ERROR,
      };
    }

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: AUTH_SESSION_MAX_AGE_SECONDS * 1000,
    });

    const cookieStore = await cookies();
    const secure = process.env.NODE_ENV === "production";

    cookieStore.set(AUTH_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    });

    await setAuthRoleCookie(user.role);

    const currentUser = mapToCurrentUser(user);

    return {
      success: true,
      redirectTo: getLoginRedirectPath(user.role),
      user: currentUser,
    };
  } catch {
    return {
      success: false,
      error: GENERIC_LOGIN_ERROR,
    };
  }
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (session) {
    try {
      const auth = getAdminAuth();
      const decoded = await auth.verifySessionCookie(session, true);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Session already invalid — still clear cookies
    }
  }

  cookieStore.delete(AUTH_SESSION_COOKIE);
  cookieStore.delete(AUTH_ROLE_COOKIE);
}

export async function getCurrentUserFromSession(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (!session) {
    return null;
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(session, true);
    const user = await findUserById(decoded.uid);
    const validation = validateUserForLogin(user);

    if (!validation.valid || !user) {
      return null;
    }

    await syncAuthRoleCookie(user.role);

    return mapToCurrentUser(user);
  } catch {
    return null;
  }
}
