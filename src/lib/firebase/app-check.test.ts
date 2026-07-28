import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/**
 * Behaviour contract for App Check init helpers (imported after env is set).
 * Production must never set FIREBASE_APPCHECK_DEBUG_TOKEN.
 */

describe("App Check development debug strategy", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
  const originalDebugToken =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    delete (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown })
      .FIREBASE_APPCHECK_DEBUG_TOKEN;
    delete (globalThis as { __gisWelfareAppCheck?: unknown }).__gisWelfareAppCheck;
    delete (globalThis as { __gisWelfareAppCheckInitAttempted?: unknown })
      .__gisWelfareAppCheckInitAttempted;
    // Minimal stubs so initializeAppCheck can run in jsdom-less node.
    // `self` is globalThis so FIREBASE_APPCHECK_DEBUG_TOKEN lands where Firebase reads it.
    vi.stubGlobal("window", globalThis as unknown as Window);
    vi.stubGlobal("self", globalThis);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY = originalSiteKey;
    }
    if (originalDebugToken === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN = originalDebugToken;
    }
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sets FIREBASE_APPCHECK_DEBUG_TOKEN=true in development when no env token is set", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY = "test-site-key";

    const initializeAppCheck = vi.fn(() => ({ type: "app-check" }));
    const ReCaptchaEnterpriseProvider = vi.fn(function Provider(this: unknown) {
      return { provider: "recaptcha-enterprise" };
    });

    vi.doMock("firebase/app-check", () => ({
      initializeAppCheck,
      ReCaptchaEnterpriseProvider,
    }));
    vi.doMock("@/lib/firebase/client", () => ({
      getFirebaseApp: () => ({ name: "[DEFAULT]" }),
    }));

    const { initializeFirebaseAppCheck } = await import("./app-check");
    initializeFirebaseAppCheck();

    expect((globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(
      true,
    );
    expect(ReCaptchaEnterpriseProvider).toHaveBeenCalledWith("test-site-key");
    expect(initializeAppCheck).toHaveBeenCalled();
  });

  it("prefers NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN over true in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY = "test-site-key";
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN =
      "11111111-2222-3333-4444-555555555555";

    vi.doMock("firebase/app-check", () => ({
      initializeAppCheck: vi.fn(() => ({ type: "app-check" })),
      ReCaptchaEnterpriseProvider: vi.fn(function Provider() {
        return { provider: "recaptcha-enterprise" };
      }),
    }));
    vi.doMock("@/lib/firebase/client", () => ({
      getFirebaseApp: () => ({ name: "[DEFAULT]" }),
    }));

    const { initializeFirebaseAppCheck } = await import("./app-check");
    initializeFirebaseAppCheck();

    expect((globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
  });

  it("does not set FIREBASE_APPCHECK_DEBUG_TOKEN in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY = "test-site-key";
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN =
      "should-be-ignored-in-production";

    vi.doMock("firebase/app-check", () => ({
      initializeAppCheck: vi.fn(() => ({ type: "app-check" })),
      ReCaptchaEnterpriseProvider: vi.fn(function Provider() {
        return { provider: "recaptcha-enterprise" };
      }),
    }));
    vi.doMock("@/lib/firebase/client", () => ({
      getFirebaseApp: () => ({ name: "[DEFAULT]" }),
    }));

    const { initializeFirebaseAppCheck } = await import("./app-check");
    initializeFirebaseAppCheck();

    expect(
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown })
        .FIREBASE_APPCHECK_DEBUG_TOKEN,
    ).toBeUndefined();
  });
});
