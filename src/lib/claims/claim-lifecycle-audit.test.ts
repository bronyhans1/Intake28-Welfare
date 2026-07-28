import { describe, expect, it } from "vitest";
import {
  appendClaimLifecycleAuditHistory,
  buildClaimLifecycleAuditEvent,
  ClaimLifecycleAuditType,
  getSortedClaimAuditHistory,
  resolveReturnReason,
} from "@/lib/claims/claim-lifecycle-audit";
import { UserRole } from "@/types/enums";

const actor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
};

describe("claim lifecycle audit history", () => {
  it("builds structured audit events", () => {
    const event = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      actor,
      metadata: { claimNumber: "GIS-2026-00001" },
    });

    expect(event).toMatchObject({
      type: "CLAIM_SUBMITTED",
      title: "Claim Submitted",
      performedByUserId: "admin-1",
      performedByName: "Admin User",
      performedByRole: UserRole.ADMIN,
      reason: null,
      metadata: { claimNumber: "GIS-2026-00001" },
    });
    expect(event.id).toBeTruthy();
    expect(event.createdAt).toBeTruthy();
  });

  it("is append-only and maintains chronological order", () => {
    const first = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_CREATED,
      actor,
      createdAt: new Date("2026-07-01T10:00:00.000Z"),
    });
    const second = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      actor,
      createdAt: new Date("2026-07-02T10:00:00.000Z"),
    });
    const third = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_RETURNED_FOR_REVISION,
      actor,
      reason: "Please provide more information.",
      createdAt: new Date("2026-07-03T10:00:00.000Z"),
    });

    const history = appendClaimLifecycleAuditHistory(
      appendClaimLifecycleAuditHistory([second, first], third),
      buildClaimLifecycleAuditEvent({
        type: ClaimLifecycleAuditType.CLAIM_RESUBMITTED,
        actor,
        createdAt: new Date("2026-07-04T10:00:00.000Z"),
      }),
    );

    expect(history.map((event) => event.type)).toEqual([
      "CLAIM_CREATED",
      "CLAIM_SUBMITTED",
      "CLAIM_RETURNED_FOR_REVISION",
      "CLAIM_RESUBMITTED",
    ]);
    expect(getSortedClaimAuditHistory({ auditHistory: history })).toHaveLength(4);
  });

  it("never removes prior events when appending", () => {
    const created = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_CREATED,
      actor,
    });
    const submitted = buildClaimLifecycleAuditEvent({
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      actor,
    });
    const next = appendClaimLifecycleAuditHistory([created], submitted);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(created);
    expect(next[1].type).toBe("CLAIM_SUBMITTED");
  });
});

describe("resolveReturnReason", () => {
  it("requires a reason and supports Other custom text", () => {
    expect(
      resolveReturnReason({
        reasonPreset: "Please provide more information.",
      }),
    ).toBe("Please provide more information.");

    expect(
      resolveReturnReason({
        reasonPreset: "Other",
        customReason: "Please attach discharge summary.",
      }),
    ).toBe("Please attach discharge summary.");

    expect(() =>
      resolveReturnReason({ reasonPreset: "Other", customReason: "" }),
    ).toThrow(/custom return reason/i);
  });
});
