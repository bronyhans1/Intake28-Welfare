import { UserRole } from "@/types/enums";

/** Visible title for the shared executive dashboard at /admin/dashboard. */
export function getExecutiveDashboardTitle(role: UserRole): string {
  if (role === UserRole.TREASURER) {
    return "Treasurer Dashboard";
  }

  return "Admin Dashboard";
}
