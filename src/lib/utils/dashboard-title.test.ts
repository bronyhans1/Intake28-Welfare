import { describe, expect, it } from "vitest";
import { UserRole } from "@/types/enums";
import { getExecutiveDashboardTitle } from "@/lib/utils/dashboard-title";

describe("getExecutiveDashboardTitle", () => {
  it("returns Admin Dashboard for admin role", () => {
    expect(getExecutiveDashboardTitle(UserRole.ADMIN)).toBe("Admin Dashboard");
  });

  it("returns Treasurer Dashboard for treasurer role", () => {
    expect(getExecutiveDashboardTitle(UserRole.TREASURER)).toBe("Treasurer Dashboard");
  });
});
