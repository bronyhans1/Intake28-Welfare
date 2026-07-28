export {
  FIREBASE_ENV_KEYS,
  firebaseWebConfigSchema,
  getFirebaseWebConfig,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "./config";

export {
  getFirebaseClient,
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
  resetFirebaseClient,
  type FirebaseClientSingleton,
} from "./client";

export { firestorePaths } from "./collections";

export { getAdminDb, getAdminAuth, isFirebaseAdminConfigured } from "./admin";

export {
  verifyFirebaseInitialization,
  verifyFirebaseConnection,
  logFirebaseVerification,
  type FirebaseVerificationResult,
} from "./verify";
