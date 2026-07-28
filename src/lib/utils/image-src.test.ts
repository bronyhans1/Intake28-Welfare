import { describe, expect, it } from "vitest";
import { getValidImageSrc } from "@/lib/utils/image-src";

describe("getValidImageSrc", () => {
  it("returns trimmed URLs", () => {
    expect(getValidImageSrc("  https://example.com/photo.jpg  ")).toBe(
      "https://example.com/photo.jpg",
    );
  });

  it("returns null for empty, null, or undefined values", () => {
    expect(getValidImageSrc(null)).toBeNull();
    expect(getValidImageSrc(undefined)).toBeNull();
    expect(getValidImageSrc("")).toBeNull();
    expect(getValidImageSrc("   ")).toBeNull();
  });
});

describe("welfare support member select display", () => {
  function formatMemberSelectLabel(
    member: { fullName: string; serviceNumber: string } | undefined,
  ): string | null {
    return member ? `${member.fullName} — ${member.serviceNumber}` : null;
  }

  it("displays member name and service number, not document id", () => {
    const label = formatMemberSelectLabel({
      fullName: "Harrison Oduro",
      serviceNumber: "IS/13984",
    });
    expect(label).toBe("Harrison Oduro — IS/13984");
    expect(label).not.toContain("uid-");
  });
});
