import { describe, expect, it } from "vitest";
import {
  getSafeNextPath,
  isPublicRoute,
  resolveMiddlewareAuth,
} from "@/lib/auth/middleware-routing";

const ORIGIN = "http://localhost:3000";

describe("isPublicRoute", () => {
  it("allows login, activate-account, and forgot-password", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/activate-account")).toBe(true);
    expect(isPublicRoute("/forgot-password")).toBe(true);
  });

  it("allows activate-account sub-routes", () => {
    expect(isPublicRoute("/activate-account/verify")).toBe(true);
    expect(isPublicRoute("/activate-account/password")).toBe(true);
    expect(isPublicRoute("/activate-account/success")).toBe(true);
  });

  it("allows forgot-password sub-routes", () => {
    expect(isPublicRoute("/forgot-password/verify")).toBe(true);
    expect(isPublicRoute("/forgot-password/reset")).toBe(true);
    expect(isPublicRoute("/forgot-password/success")).toBe(true);
  });

  it("does not treat protected routes as public", () => {
    expect(isPublicRoute("/dashboard")).toBe(false);
    expect(isPublicRoute("/admin/dashboard")).toBe(false);
  });
});

describe("getSafeNextPath", () => {
  it("returns null for login to prevent redirect loops", () => {
    expect(getSafeNextPath("/login")).toBeNull();
  });

  it("returns null for public routes", () => {
    expect(getSafeNextPath("/activate-account")).toBeNull();
    expect(getSafeNextPath("/forgot-password")).toBeNull();
  });

  it("returns protected paths for post-login redirect", () => {
    expect(getSafeNextPath("/dashboard")).toBe("/dashboard");
    expect(getSafeNextPath("/admin/dashboard")).toBe("/admin/dashboard");
  });
});

describe("resolveMiddlewareAuth", () => {
  it("allows anonymous access to /login", () => {
    const decision = resolveMiddlewareAuth("/login", false, ORIGIN);
    expect(decision).toEqual({ action: "allow" });
  });

  it("allows anonymous access to /activate-account", () => {
    const decision = resolveMiddlewareAuth("/activate-account", false, ORIGIN);
    expect(decision).toEqual({ action: "allow" });
  });

  it("allows anonymous access to activate-account sub-routes", () => {
    const decision = resolveMiddlewareAuth("/activate-account/verify", false, ORIGIN);
    expect(decision).toEqual({ action: "allow" });
  });

  it("redirects anonymous /dashboard to login with next param", () => {
    const decision = resolveMiddlewareAuth("/dashboard", false, ORIGIN);
    expect(decision).toEqual({
      action: "redirect",
      url: `${ORIGIN}/login?next=%2Fdashboard`,
    });
  });

  it("redirects anonymous /admin/dashboard to login with next param", () => {
    const decision = resolveMiddlewareAuth("/admin/dashboard", false, ORIGIN);
    expect(decision).toEqual({
      action: "redirect",
      url: `${ORIGIN}/login?next=%2Fadmin%2Fdashboard`,
    });
  });

  it("allows authenticated access to protected routes", () => {
    expect(resolveMiddlewareAuth("/dashboard", true, ORIGIN)).toEqual({
      action: "allow",
    });
    expect(resolveMiddlewareAuth("/admin/dashboard", true, ORIGIN)).toEqual({
      action: "allow",
    });
  });

  it("never generates /login?next=/login", () => {
    const loginDecision = resolveMiddlewareAuth("/login", false, ORIGIN);
    expect(loginDecision).toEqual({ action: "allow" });

    const nextPath = getSafeNextPath("/login");
    expect(nextPath).toBeNull();

    const dashboardDecision = resolveMiddlewareAuth("/dashboard", false, ORIGIN);
    if (dashboardDecision.action === "redirect") {
      const url = new URL(dashboardDecision.url);
      expect(url.searchParams.get("next")).not.toBe("/login");
      expect(url.pathname).toBe("/login");
    }
  });

  it("does not create redirect chains for repeated login requests", () => {
    const first = resolveMiddlewareAuth("/login", false, ORIGIN);
    const second = resolveMiddlewareAuth("/login", false, ORIGIN);
    expect(first).toEqual({ action: "allow" });
    expect(second).toEqual({ action: "allow" });
  });
});
