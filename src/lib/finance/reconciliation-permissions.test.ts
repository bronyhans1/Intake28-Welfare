import { describe, expect, it } from "vitest";
import {
  canRecoverUnsettledPayments,
  canViewReconciliation,
} from "@/lib/finance/reconciliation-permissions";
import { UserRole } from "@/types/enums";

describe("reconciliation permissions", () => {
  it("allows admin and treasurer to view and recover", () => {
    expect(canViewReconciliation(UserRole.ADMIN)).toBe(true);
    expect(canViewReconciliation(UserRole.TREASURER)).toBe(true);
    expect(canRecoverUnsettledPayments(UserRole.ADMIN)).toBe(true);
    expect(canRecoverUnsettledPayments(UserRole.TREASURER)).toBe(true);
  });

  it("denies members recovery and reconciliation view", () => {
    expect(canViewReconciliation(UserRole.MEMBER)).toBe(false);
    expect(canRecoverUnsettledPayments(UserRole.MEMBER)).toBe(false);
  });
});
