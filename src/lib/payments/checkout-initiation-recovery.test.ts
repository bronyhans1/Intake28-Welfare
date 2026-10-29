import { describe, expect, it } from "vitest";
import {
  describeOrphanPendingRecovery,
  ORPHAN_PENDING_RECOVERY,
} from "@/lib/payments/checkout-initiation-recovery";
import { PAYMENT_ABANDONMENT_HOURS } from "@/lib/payments/lifecycle";

describe("orphan PENDING checkout recovery guidance", () => {
  it("refuses auto-fail and blind retry of uncertain initiate failures", () => {
    expect(ORPHAN_PENDING_RECOVERY.doNotAutoFail).toBe(true);
    expect(ORPHAN_PENDING_RECOVERY.doNotBlindRetrySameReference).toBe(true);
    expect(ORPHAN_PENDING_RECOVERY.preferStatusVerification).toBe(true);
    expect(ORPHAN_PENDING_RECOVERY.abandonmentHours).toBe(PAYMENT_ABANDONMENT_HOURS);
  });

  it("documents operator recovery steps", () => {
    const guidance = describeOrphanPendingRecovery();
    expect(guidance).toMatch(/Check status/i);
    expect(guidance).toMatch(/manual admin contribution/i);
    expect(guidance).not.toMatch(/automatically mark.*failed/i);
  });
});
