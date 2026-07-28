import { describe, expect, it } from "vitest";
import {
  resolveEmailAuditAction,
  resolveProfilePhotoAuditAction,
  MemberAuditAction,
} from "@/lib/members/audit";

describe("member audit action resolvers", () => {
  it("resolves email audit actions", () => {
    expect(resolveEmailAuditAction(null, "mary@gmail.com")).toBe(
      MemberAuditAction.EMAIL_ADDED,
    );
    expect(resolveEmailAuditAction("mary@gmail.com", "simon@gmail.com")).toBe(
      MemberAuditAction.EMAIL_UPDATED,
    );
    expect(resolveEmailAuditAction("mary@gmail.com", null)).toBe(
      MemberAuditAction.EMAIL_REMOVED,
    );
    expect(resolveEmailAuditAction("mary@gmail.com", "mary@gmail.com")).toBeNull();
  });

  it("resolves profile photo audit actions", () => {
    expect(resolveProfilePhotoAuditAction(null, "https://example.com/photo.jpg")).toBe(
      MemberAuditAction.PROFILE_PHOTO_UPLOADED,
    );
    expect(
      resolveProfilePhotoAuditAction(
        "https://example.com/old.jpg",
        "https://example.com/new.jpg",
      ),
    ).toBe(MemberAuditAction.PROFILE_PHOTO_UPDATED);
    expect(resolveProfilePhotoAuditAction("https://example.com/photo.jpg", null)).toBe(
      MemberAuditAction.PROFILE_PHOTO_REMOVED,
    );
  });
});
