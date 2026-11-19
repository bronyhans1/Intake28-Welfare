import { z } from "zod";

/**
 * Firebase Web SDK configuration shape.
 * @see https://firebase.google.com/docs/web/setup#config-object
 */
export const firebaseWebConfigSchema = z.object({
  apiKey: z.string().min(1, "NEXT_PUBLIC_FIREBASE_API_KEY is required"),
  authDomain: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is required"),
  projectId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_PROJECT_ID is required"),
  storageBucket: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required"),
  messagingSenderId: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is required"),
  appId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_APP_ID is required"),
});

export type FirebaseWebConfig = z.infer<typeof firebaseWebConfigSchema>;

/** Environment variable keys for Firebase Web SDK (all NEXT_PUBLIC_) */
export const FIREBASE_ENV_KEYS = {
  API_KEY: "NEXT_PUBLIC_FIREBASE_API_KEY",
  AUTH_DOMAIN: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  PROJECT_ID: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  STORAGE_BUCKET: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  MESSAGING_SENDER_ID: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  APP_ID: "NEXT_PUBLIC_FIREBASE_APP_ID",
} as const;

/**
 * Loads and validates Firebase Web SDK configuration from environment variables.
 * Throws a descriptive Zod error if any value is missing.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  return firebaseWebConfigSchema.parse({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

/**
 * Returns true when all required Firebase environment variables are present.
 * Does not validate format — use getFirebaseWebConfig() for full validation.
 */
export function isFirebaseConfigured(): boolean {
  return firebaseWebConfigSchema.safeParse({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }).success;
}
