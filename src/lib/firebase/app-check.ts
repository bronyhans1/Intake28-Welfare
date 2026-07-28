"use client";

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import { getFirebaseApp } from "@/lib/firebase/client";

declare global {
  interface Window {
    __gisWelfareAppCheck?: AppCheck | null;
    __gisWelfareAppCheckInitAttempted?: boolean;
    /**
     * Official Firebase App Check debug flag.
     * Set on `self` before initializeAppCheck() in development only.
     * @see https://firebase.google.com/docs/app-check/web/debug-provider
     */
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

/**
 * True only for non-production builds (`next dev` / non-production Next bundles).
 * Production (`next build` + `next start`) never enables the debug provider.
 */
function isAppCheckDebugBuild(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Enables the official App Check debug provider for development builds.
 * Must run before initializeAppCheck().
 *
 * Prefers NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN (registered token string)
 * so localhost, LAN IPs, and other Wi‑Fi devices can share one safelisted token.
 * Falls back to `true` (Firebase prints a per-browser token to register).
 *
 * @see https://firebase.google.com/docs/app-check/web/debug-provider
 */
function enableAppCheckDebugProviderIfDevelopment(): void {
  if (!isAppCheckDebugBuild()) {
    return;
  }

  const configuredToken =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() || "";

  // Official mechanism: self.FIREBASE_APPCHECK_DEBUG_TOKEN before init.
  const debugToken: boolean | string = configuredToken || true;
  (self as Window).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;

  if (configuredToken) {
    console.info(
      "[App Check] Development debug token from NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN is enabled.",
    );
  } else {
    console.info(
      [
        "[App Check] Development debug mode enabled (FIREBASE_APPCHECK_DEBUG_TOKEN=true).",
        "If Firebase prints a debug token in the console, register it in:",
        "Firebase Console → App Check → Apps → ⋮ → Manage debug tokens.",
        "For LAN / other devices, set NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN to that registered token in .env.local (do not commit).",
      ].join(" "),
    );
  }
}

/**
 * Initializes Firebase App Check once in the browser.
 * Safe to call repeatedly from client components; SSR always no-ops.
 *
 * Production: ReCaptchaEnterpriseProvider only (unchanged).
 * Development: debug provider via FIREBASE_APPCHECK_DEBUG_TOKEN, then same init API.
 */
export function initializeFirebaseAppCheck(): AppCheck | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__gisWelfareAppCheck) {
    return window.__gisWelfareAppCheck;
  }

  if (window.__gisWelfareAppCheckInitAttempted) {
    return null;
  }

  window.__gisWelfareAppCheckInitAttempted = true;

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim();
  if (!siteKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Firebase App Check was not initialized because NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is missing.",
      );
    }
    return null;
  }

  try {
    enableAppCheckDebugProviderIfDevelopment();

    // Production and development both pass ReCaptchaEnterpriseProvider to the
    // official initializeAppCheck API. In development, FIREBASE_APPCHECK_DEBUG_TOKEN
    // switches attestation to the debug provider without changing production behaviour.
    const appCheck = initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    window.__gisWelfareAppCheck = appCheck;
    return appCheck;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Firebase App Check initialization failed.", error);
    }
    return null;
  }
}
