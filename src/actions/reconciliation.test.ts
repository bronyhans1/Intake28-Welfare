import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@/types/enums";

const mockGetCurrentUser = vi.fn();
const mockRecover = vi.fn();
const mockRevalidatePath = vi.fn();
const mockIsFirebaseAdminConfigured = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserFromSession: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  isFirebaseAdminConfigured: () => mockIsFirebaseAdminConfigured(),
}));

vi.mock("@/lib/finance/recover-unsettled-payment", () => ({
  recoverUnsettledPaystackPayment: (...args: unknown[]) => mockRecover(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe("recoverUnsettledPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFirebaseAdminConfigured.mockReturnValue(true);
  });

  it("revalidates reconciliation after successful recovery", async () => {
    mockGetCurrentUser.mockResolvedValue({
      uid: "admin-1",
      role: UserRole.ADMIN,
      fullName: "Admin",
      serviceNumber: "IS/00001",
      profileCompleted: true,
      profileCompletionPercentage: 100,
    });
    mockRecover.mockResolvedValue({
      outcome: "recovered",
      reference: "GIS-RECOVER-001",
      message: "Payment recovered.",
    });

    const { recoverUnsettledPaymentAction } = await import("@/actions/reconciliation");
    const result = await recoverUnsettledPaymentAction("GIS-RECOVER-001");

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("recovered");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/finance/reconciliation");
  });

  it("does not recover when unauthorized", async () => {
    mockGetCurrentUser.mockResolvedValue({
      uid: "member-1",
      role: UserRole.MEMBER,
      fullName: "Member",
      serviceNumber: "IS/12003",
      profileCompleted: true,
      profileCompletionPercentage: 100,
    });

    const { recoverUnsettledPaymentAction } = await import("@/actions/reconciliation");
    const result = await recoverUnsettledPaymentAction("GIS-RECOVER-001");

    expect(result.outcome).toBe("unauthorized");
    expect(mockRecover).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
