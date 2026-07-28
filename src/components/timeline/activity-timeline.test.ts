import { describe, expect, it } from "vitest";
import {
  resolveTimelineEventDisplay,
  resolveTimelineEventTitle,
  TIMELINE_EVENT_DISPLAY_CONFIG,
} from "@/components/timeline/event-config";
import {
  formatTimelineDateTime,
  formatTimelineRole,
  sortTimelineEvents,
} from "@/components/timeline/timeline-utils";
import type { TimelineEvent } from "@/components/timeline/types";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import type { ClaimLifecycleAuditEvent } from "@/types/claims";
import { UserRole } from "@/types/enums";

const sampleHistory: ClaimLifecycleAuditEvent[] = [
  {
    id: "e2",
    type: "CLAIM_SUBMITTED",
    title: "Claim Submitted",
    performedByUserId: "m1",
    performedByName: "Harrison Oduro",
    performedByRole: UserRole.MEMBER,
    createdAt: "2026-07-24T10:22:00.000Z",
    reason: null,
    metadata: { claimNumber: "GIS-2026-00001" },
  },
  {
    id: "e1",
    type: "CLAIM_CREATED",
    title: "Claim Created",
    performedByUserId: "m1",
    performedByName: "Harrison Oduro",
    performedByRole: UserRole.MEMBER,
    createdAt: "2026-07-24T10:15:00.000Z",
    reason: null,
    metadata: {},
  },
  {
    id: "e3",
    type: "CLAIM_RETURNED_FOR_REVISION",
    title: "Claim Returned for Revision",
    performedByUserId: "a1",
    performedByName: "Admin User",
    performedByRole: UserRole.ADMIN,
    createdAt: "2026-07-26T14:45:00.000Z",
    reason: "Please clarify the incident date.",
    metadata: {},
  },
];

describe("ActivityTimeline data helpers", () => {
  it("renders timeline events from audit history via adapter", () => {
    const events = claimAuditHistoryToTimelineEvents(sampleHistory);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("CLAIM_CREATED");
    expect(events[1].performedByName).toBe("Harrison Oduro");
    expect(events[2].reason).toBe("Please clarify the incident date.");
  });

  it("keeps chronological order", () => {
    const events = claimAuditHistoryToTimelineEvents(sampleHistory);
    expect(events.map((event) => event.type)).toEqual([
      "CLAIM_CREATED",
      "CLAIM_SUBMITTED",
      "CLAIM_RETURNED_FOR_REVISION",
    ]);

    const resorted = sortTimelineEvents([...events].reverse());
    expect(resorted.map((event) => event.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("maps configured titles and supports future event types", () => {
    expect(resolveTimelineEventTitle({ type: "CLAIM_CREATED", title: "x" })).toBe(
      "Claim Created",
    );
    expect(
      resolveTimelineEventTitle({
        type: "CLAIM_RETURNED_FOR_REVISION",
        title: "x",
      }),
    ).toBe("Returned for Revision");

    expect(TIMELINE_EVENT_DISPLAY_CONFIG.APPROVED?.title).toBe("Approved");
    expect(resolveTimelineEventDisplay("APPROVED").tone).toBe("success");
    expect(resolveTimelineEventDisplay("UNKNOWN_FUTURE_EVENT").tone).toBe(
      "neutral",
    );
    expect(
      resolveTimelineEventTitle({
        type: "UNKNOWN_FUTURE_EVENT",
        title: "Custom Future Event",
      }),
    ).toBe("Custom Future Event");
  });

  it("formats user role and date/time", () => {
    expect(formatTimelineRole("admin")).toBe("Administrator");
    expect(formatTimelineRole("member")).toBe("Member");
    expect(formatTimelineDateTime("2026-07-24T10:15:00.000Z")).toMatch(
      /2026/,
    );
  });

  it("handles empty history for member and admin consumers", () => {
    expect(claimAuditHistoryToTimelineEvents([])).toEqual([]);
    expect(claimAuditHistoryToTimelineEvents(null)).toEqual([]);
    expect(claimAuditHistoryToTimelineEvents(undefined)).toEqual([]);
  });

  it("remains reusable for non-claim timeline events", () => {
    const paymentEvents: TimelineEvent[] = [
      {
        id: "p1",
        type: "PAYMENT_COMPLETED",
        title: "Payment Completed",
        createdAt: "2026-07-01T12:00:00.000Z",
        performedByName: "Treasurer",
        performedByRole: "treasurer",
        reason: null,
        metadata: { amount: 50 },
      },
    ];

    expect(resolveTimelineEventDisplay("PAYMENT_COMPLETED").icon).toBe(
      "circleCheck",
    );
    expect(sortTimelineEvents(paymentEvents)[0].title).toBe("Payment Completed");
  });
});
