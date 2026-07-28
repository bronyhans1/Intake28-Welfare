import { doc, getDoc } from "firebase/firestore";
import { isFirebaseConfigured } from "./config";
import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseClient,
  getFirebaseDb,
} from "./client";

export interface FirebaseVerificationResult {
  success: boolean;
  appInitialized: boolean;
  authInitialized: boolean;
  firestoreInitialized: boolean;
  firestoreConnected: boolean;
  projectId: string | null;
  errors: string[];
}

function isFirebaseError(
  error: unknown,
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/**
 * Synchronous structural verification — confirms SDK instances are initialized.
 * Does not perform a network request.
 */
export function verifyFirebaseInitialization(): FirebaseVerificationResult {
  const errors: string[] = [];

  if (!isFirebaseConfigured()) {
    return {
      success: false,
      appInitialized: false,
      authInitialized: false,
      firestoreInitialized: false,
      firestoreConnected: false,
      projectId: null,
      errors: [
        "Firebase environment variables are missing. Copy .env.example to .env.local and add your Firebase Web SDK config from Firebase Console.",
      ],
    };
  }

  try {
    const { app, auth, db } = getFirebaseClient();

    const appInitialized = Boolean(app.name);
    const authInitialized = auth.app === app;
    const firestoreInitialized = db.app === app;
    const projectId = app.options.projectId ?? null;

    if (!appInitialized) errors.push("Firebase App is not initialized.");
    if (!authInitialized) errors.push("Firebase Auth is not initialized.");
    if (!firestoreInitialized)
      errors.push("Firestore is not initialized.");

    return {
      success: appInitialized && authInitialized && firestoreInitialized,
      appInitialized,
      authInitialized,
      firestoreInitialized,
      firestoreConnected: false,
      projectId,
      errors,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown initialization error";
    return {
      success: false,
      appInitialized: false,
      authInitialized: false,
      firestoreInitialized: false,
      firestoreConnected: false,
      projectId: null,
      errors: [message],
    };
  }
}

/**
 * Async verification — includes a lightweight Firestore network probe.
 * A `permission-denied` response confirms Firestore is reachable.
 */
export async function verifyFirebaseConnection(): Promise<FirebaseVerificationResult> {
  const initResult = verifyFirebaseInitialization();

  if (!initResult.success) {
    return initResult;
  }

  const errors = [...initResult.errors];

  try {
    const db = getFirebaseDb();
    await getDoc(doc(db, "_firebase_connection_probe", "ping"));

    return {
      ...initResult,
      firestoreConnected: true,
      success: true,
      errors,
    };
  } catch (error) {
    if (isFirebaseError(error)) {
      if (error.code === "permission-denied") {
        return {
          ...initResult,
          firestoreConnected: true,
          success: true,
          errors,
        };
      }

      if (error.code === "unavailable") {
        errors.push("Firestore is unavailable — check network connectivity.");
      } else {
        errors.push(`Firestore connection error: ${error.message}`);
      }
    } else {
      const message =
        error instanceof Error ? error.message : "Unknown connection error";
      errors.push(message);
    }

    return {
      ...initResult,
      firestoreConnected: false,
      success: false,
      errors,
    };
  }
}

/** Quick check used during development — logs result to console */
export async function logFirebaseVerification(): Promise<FirebaseVerificationResult> {
  const result = await verifyFirebaseConnection();

  const status = result.success ? "OK" : "FAILED";
  console.log(`[Firebase] Verification: ${status}`);
  console.log(`  App initialized:       ${result.appInitialized}`);
  console.log(`  Auth initialized:      ${result.authInitialized}`);
  console.log(`  Firestore initialized: ${result.firestoreInitialized}`);
  console.log(`  Firestore connected:   ${result.firestoreConnected}`);
  console.log(`  Project ID:            ${result.projectId ?? "—"}`);

  if (result.errors.length > 0) {
    console.error("  Errors:", result.errors);
  }

  return result;
}

/** @internal Exported for testing — direct instance accessors */
export const _firebaseInstances = {
  getApp: getFirebaseApp,
  getAuth: getFirebaseAuth,
  getDb: getFirebaseDb,
};
