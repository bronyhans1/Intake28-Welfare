import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAYMENTS_UNAVAILABLE_MESSAGE } from "@/lib/payments/availability";
import { UserRole } from "@/types/enums";

const mockGetCurrentUserFromSession = vi.fn();
const mockIsFirebaseAdminConfigured = vi.fn();
const mockInitializePayment = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserFromSession: (...args: unknown[]) =>
    mockGetCurrentUserFromSession(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  isFirebaseAdminConfigured: () => mockIsFirebaseAdminConfigured(),
}));

vi.mock("@/lib/payments/repository", () => ({
  initializePayment: (...args: unknown[]) => mockInitializePayment(...args),
}));

import { POST } from "./route";

describe("POST /api/payments/initialize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    mockIsFirebaseAdminConfigured.mockReturnValue(true);
    mockGetCurrentUserFromSession.mockResolvedValue({
      uid: "member-1",
      role: UserRole.MEMBER,
      fullName: "Member User",
      serviceNumber: "IS/00002",
      profileCompleted: true,
      profileCompletionPercentage: 100,
    });
    mockInitializePayment.mockResolvedValue({
      reference: "GIS-20260617-AB1234",
      authorizationUrl: "https://checkout.paystack.com/test",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 and does not initialize when payments are disabled", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "false");

    const response = await POST(
      new Request("http://localhost/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          paymentType: "monthly_dues",
          selectedMonths: [{ month: 6, year: 2026 }],
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: PAYMENTS_UNAVAILABLE_MESSAGE,
    });
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it("initializes when payments are enabled", async () => {
    const response = await POST(
      new Request("http://localhost/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberId: "member-1",
          paymentType: "monthly_dues",
          selectedMonths: [{ month: 6, year: 2026 }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        reference: "GIS-20260617-AB1234",
        authorizationUrl: "https://checkout.paystack.com/test",
      },
    });
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
  });
});
