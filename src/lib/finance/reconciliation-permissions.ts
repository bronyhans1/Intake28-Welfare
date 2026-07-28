import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/enums";

export function canViewReconciliation(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_RECONCILIATION);
}
