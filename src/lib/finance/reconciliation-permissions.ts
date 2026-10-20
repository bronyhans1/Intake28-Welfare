import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/enums";

export function canViewReconciliation(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_RECONCILIATION);
}

/**
 * Admin/treasurer recovery of unsettled Paystack successes from reconciliation.
 * Requires both reconciliation visibility and contribution create authority.
 */
export function canRecoverUnsettledPayments(role: UserRole): boolean {
  return (
    canViewReconciliation(role) &&
    hasPermission(role, Permission.CREATE_CONTRIBUTIONS)
  );
}
