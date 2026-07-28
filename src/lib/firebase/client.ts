import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseWebConfig } from "./config";

/** Strongly typed Firebase client singleton */
export interface FirebaseClientSingleton {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Firestore;
  readonly storage: FirebaseStorage;
}

let client: FirebaseClientSingleton | null = null;

function createFirebaseClient(): FirebaseClientSingleton {
  const config = getFirebaseWebConfig();

  const app = getApps().length > 0 ? getApp() : initializeApp(config);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

/**
 * Returns the Firebase client singleton.
 * Lazily initializes App, Auth, Firestore, and Storage on first access.
 */
export function getFirebaseClient(): FirebaseClientSingleton {
  if (!client) {
    client = createFirebaseClient();
  }
  return client;
}

/** Resets the singleton — for testing only */
export function resetFirebaseClient(): void {
  client = null;
}

/** Convenience accessors */
export function getFirebaseApp(): FirebaseApp {
  return getFirebaseClient().app;
}

export function getFirebaseAuth(): Auth {
  return getFirebaseClient().auth;
}

export function getFirebaseDb(): Firestore {
  return getFirebaseClient().db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return getFirebaseClient().storage;
}
