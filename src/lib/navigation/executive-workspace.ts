import { canAccessAdminRoute } from "@/lib/auth/login";
import { UserRole } from "@/types/enums";

export const EXECUTIVE_DASHBOARD_PATH = "/admin/dashboard";

export function canShowExecutiveDashboardLink(role: UserRole): boolean {
  return canAccessAdminRoute(role);
}

export function getExecutiveDashboardReturnLabel(role: UserRole): string | null {
  if (role === UserRole.TREASURER) {
    return "Return to Treasurer Dashboard";
  }

  if (role === UserRole.ADMIN) {
    return "Return to Admin Dashboard";
  }

  return null;
}
