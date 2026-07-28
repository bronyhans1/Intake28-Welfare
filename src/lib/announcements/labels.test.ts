import { describe, expect, it } from "vitest";
import {
  formatAnnouncementAudienceFilterLabel,
  formatAnnouncementAudienceLabel,
  formatAnnouncementStatusFilterLabel,
  formatAnnouncementStatusLabel,
} from "@/lib/announcements/labels";
import { AnnouncementAudience, AnnouncementStatus } from "@/types/enums";

describe("formatAnnouncementAudienceLabel", () => {
  it.each([
    [AnnouncementAudience.ALL_MEMBERS, "All Members"],
    [AnnouncementAudience.ACTIVE_MEMBERS, "Active Members"],
    [AnnouncementAudience.DEFAULTERS, "Defaulters"],
    [AnnouncementAudience.TREASURERS, "Treasurers"],
    [AnnouncementAudience.ADMINS, "Administrators"],
  ])("maps %s to %s", (value, label) => {
    expect(formatAnnouncementAudienceLabel(value)).toBe(label);
  });

  it("never returns raw enum strings", () => {
    for (const value of Object.values(AnnouncementAudience)) {
      const label = formatAnnouncementAudienceLabel(value);
      expect(label).not.toContain("_");
      expect(label).not.toBe(value);
    }
  });
});

describe("formatAnnouncementStatusLabel", () => {
  it.each([
    [AnnouncementStatus.DRAFT, "Draft"],
    [AnnouncementStatus.PUBLISHED, "Published"],
    [AnnouncementStatus.ARCHIVED, "Archived"],
  ])("maps %s to %s", (value, label) => {
    expect(formatAnnouncementStatusLabel(value)).toBe(label);
  });

  it("never returns raw enum strings", () => {
    for (const value of Object.values(AnnouncementStatus)) {
      const label = formatAnnouncementStatusLabel(value);
      expect(label).not.toContain("_");
      expect(label).not.toBe(value);
    }
  });
});

describe("announcement filter labels", () => {
  it("shows All Audiences when filter is all", () => {
    expect(formatAnnouncementAudienceFilterLabel("all")).toBe("All Audiences");
  });

  it("shows friendly label when audience filter has enum value", () => {
    expect(formatAnnouncementAudienceFilterLabel(AnnouncementAudience.TREASURERS)).toBe(
      "Treasurers",
    );
  });

  it("shows All Statuses when filter is all", () => {
    expect(formatAnnouncementStatusFilterLabel("all")).toBe("All Statuses");
  });

  it("shows friendly label when status filter has enum value", () => {
    expect(formatAnnouncementStatusFilterLabel(AnnouncementStatus.PUBLISHED)).toBe(
      "Published",
    );
  });
});
