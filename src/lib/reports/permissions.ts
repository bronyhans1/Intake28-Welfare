import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/enums";

export function canViewReports(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_REPORTS);
}

export function canExportReports(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_REPORTS);
}
