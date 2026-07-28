"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDocFromServer } from "firebase/firestore";
import { destroyAuthSession, syncSessionRoleAction } from "@/actions/auth";
import { COLLECTIONS } from "@/lib/constants";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { User } from "@/types/user";

type FetchCurrentUserFailureReason =
  | "permission_denied"
  | "snapshot_missing"
  | "activation_status_mismatch"
  | "user_status_mismatch"
  | "unexpected_exception";

interface FetchCurrentUserResult {
  user: CurrentUser | null;
  failureReason?: FetchCurrentUserFailureReason;
  error?: unknown;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirestoreUser(uid: string, data: User): CurrentUser {
  return {
    uid,
    fullName: data.fullName,
    serviceNumber: data.serviceNumber,
    role: data.role,
    profileCompleted: data.profileCompleted,
    profileCompletionPercentage: data.profileCompletionPercentage,
    profilePhotoUrl: data.profilePhotoUrl ?? null,
    gender: data.gender ?? null,
  };
}

function getFirestoreErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: string }).code);
  }
  return null;
}

async function fetchCurrentUser(
  firebaseUser: FirebaseUser,
): Promise<FetchCurrentUserResult> {
  try {
    const snapshot = await getDocFromServer(
      doc(getFirebaseDb(), COLLECTIONS.USERS, firebaseUser.uid),
    );

    if (!snapshot.exists()) {
      return { user: null, failureReason: "snapshot_missing" };
    }

    const data = { id: snapshot.id, ...snapshot.data() } as User;

    if (data.activationStatus !== ActivationStatus.ACTIVATED) {
      return { user: null, failureReason: "activation_status_mismatch" };
    }

    if (data.status !== UserStatus.ACTIVE) {
      return { user: null, failureReason: "user_status_mismatch" };
    }

    const user = mapFirestoreUser(firebaseUser.uid, data);

    // Keep the role cookie aligned with Firestore after role changes
    await syncSessionRoleAction(user.role);

    return { user };
  } catch (error) {
    const errorCode = getFirestoreErrorCode(error);
    const failureReason: FetchCurrentUserFailureReason =
      errorCode === "permission-denied"
        ? "permission_denied"
        : "unexpected_exception";

    return { user: null, failureReason, error };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setUser(null);
      return;
    }

    const result = await fetchCurrentUser(firebaseUser);
    setUser(result.user);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const result = await fetchCurrentUser(firebaseUser);
      setUser(result.user);

      const shouldSignOut =
        !result.user &&
        (result.failureReason === "snapshot_missing" ||
          result.failureReason === "activation_status_mismatch" ||
          result.failureReason === "user_status_mismatch");

      if (shouldSignOut) {
        await signOut(auth);
        await destroyAuthSession();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(getFirebaseAuth());
      await destroyAuthSession();
      setUser(null);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      logout,
      refreshUser,
    }),
    [user, loading, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useCurrentUser(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useCurrentUser must be used within an AuthProvider.");
  }

  return context;
}
