import { describe, expect, it } from "vitest";
import {
  canShowExecutiveDashboardLink,
  EXECUTIVE_DASHBOARD_PATH,
  getExecutiveDashboardReturnLabel,
} from "@/lib/navigation/executive-workspace";
import { UserRole } from "@/types/enums";

describe("executive workspace navigation", () => {
  it("shows the executive dashboard link for admin and treasurer only", () => {
    expect(canShowExecutiveDashboardLink(UserRole.ADMIN)).toBe(true);
    expect(canShowExecutiveDashboardLink(UserRole.TREASURER)).toBe(true);
    expect(canShowExecutiveDashboardLink(UserRole.MEMBER)).toBe(false);
  });

  it("uses role-specific return labels", () => {
    expect(getExecutiveDashboardReturnLabel(UserRole.ADMIN)).toBe(
      "Return to Admin Dashboard",
    );
    expect(getExecutiveDashboardReturnLabel(UserRole.TREASURER)).toBe(
      "Return to Treasurer Dashboard",
    );
    expect(getExecutiveDashboardReturnLabel(UserRole.MEMBER)).toBeNull();
  });

  it("links executives back to the shared admin dashboard route", () => {
    expect(EXECUTIVE_DASHBOARD_PATH).toBe("/admin/dashboard");
  });
});
