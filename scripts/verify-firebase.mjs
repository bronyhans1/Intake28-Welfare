/**
 * Standalone Firebase connection verification script.
 * Run: npm run firebase:verify
 *
 * Loads .env.local (or .env), initializes Firebase, and checks App / Auth / Firestore.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

function loadEnvFile(filename) {
  const filePath = resolve(root, filename);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const missing = FIREBASE_ENV_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("[Firebase] Verification: FAILED");
  console.error("Missing environment variables:");
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  console.error(
    "\nCopy .env.example to .env.local and add values from Firebase Console → Project Settings → Your apps → Web app → Config.",
  );
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appInitialized = Boolean(app.name);
const authInitialized = auth.app === app;
const firestoreInitialized = db.app === app;

console.log("[Firebase] Verification");
console.log(`  App initialized:       ${appInitialized}`);
console.log(`  Auth initialized:      ${authInitialized}`);
console.log(`  Firestore initialized: ${firestoreInitialized}`);
console.log(`  Project ID:            ${app.options.projectId ?? "—"}`);

let firestoreConnected = false;

try {
  await getDoc(doc(db, "_firebase_connection_probe", "ping"));
  firestoreConnected = true;
} catch (error) {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "permission-denied") {
      firestoreConnected = true;
    } else {
      console.error(`  Firestore error: ${error.code} — ${error.message}`);
    }
  } else {
    console.error("  Firestore error:", error);
  }
}

console.log(`  Firestore connected:   ${firestoreConnected}`);

const success =
  appInitialized && authInitialized && firestoreInitialized && firestoreConnected;

console.log(`\n[Firebase] Result: ${success ? "OK" : "FAILED"}`);
process.exit(success ? 0 : 1);
