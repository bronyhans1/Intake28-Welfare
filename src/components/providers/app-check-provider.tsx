"use client";

import { useEffect } from "react";
import { initializeFirebaseAppCheck } from "@/lib/firebase/app-check";

/**
 * Boots App Check once for the whole app and renders nothing.
 */
export function AppCheckProvider() {
  useEffect(() => {
    initializeFirebaseAppCheck();
  }, []);

  return null;
}
