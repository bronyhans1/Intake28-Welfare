import { describe, expect, it } from "vitest";
import {
  formatNotificationEventLabel,
  formatNotificationMessage,
  getNotificationActionLabel,
} from "@/lib/notifications/labels";
import {
  NotificationEventType,
  NotificationModule,
} from "@/lib/notifications/types";

describe("notification labels", () => {
  it("formats known profile notification types", () => {
    expect(formatNotificationEventLabel(NotificationEventType.PROFILE_PHONE_CHANGED)).toBe(
      "Phone changed",
    );
    expect(formatNotificationEventLabel(NotificationEventType.PROFILE_PHOTO_CHANGED)).toBe(
      "Profile photo updated",
    );
  });

  it("builds readable notification messages", () => {
    expect(
      formatNotificationMessage({
        eventType: NotificationEventType.PROFILE_PHONE_CHANGED,
        actorName: "Mary Baah",
        memberName: "Mary Baah",
      }),
    ).toBe("Mary Baah phone changed");

    expect(
      formatNotificationMessage({
        eventType: NotificationEventType.PROFILE_PHOTO_CHANGED,
        actorName: "Simon Appaih",
        memberName: "Simon Appaih",
      }),
    ).toBe("Simon Appaih updated their profile photo");
  });

  it("prefers stored message and builds action labels", () => {
    expect(
      formatNotificationMessage({
        eventType: NotificationEventType.CLAIM_APPROVED,
        actorName: "Admin",
        memberName: "Mary",
        message: "Claim CLM-001: Claim Approved.",
      }),
    ).toBe("Claim CLM-001: Claim Approved.");

    expect(
      getNotificationActionLabel(
        NotificationEventType.CLAIM_PAID,
        NotificationModule.CLAIMS,
      ),
    ).toBe("View Claim");
  });
});
