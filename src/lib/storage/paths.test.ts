import { describe, expect, it } from "vitest";
import {
  buildAnnouncementStoragePath,
  buildClaimStoragePath,
  buildConstitutionStoragePath,
  buildProfilePhotoStoragePath,
  buildReceiptStoragePath,
  sanitizeStorageServiceNumber,
} from "@/lib/storage/paths";

describe("storage folder conventions", () => {
  it("keeps service-number folders slash-free", () => {
    expect(sanitizeStorageServiceNumber("IS/14001")).toBe("IS14001");
  });

  it("matches the required folder layout", () => {
    expect(buildProfilePhotoStoragePath("IS/14001")).toBe(
      "profile-photos/IS14001/profile.webp",
    );
    expect(buildReceiptStoragePath("2026", "r1.pdf")).toBe("receipts/2026/r1.pdf");
    expect(buildClaimStoragePath("IS/14001", "c1.pdf")).toBe(
      "claims/IS14001/c1.pdf",
    );
    expect(buildAnnouncementStoragePath("a1.pdf")).toBe("announcements/a1.pdf");
    expect(buildConstitutionStoragePath("constitution.pdf")).toBe(
      "constitution/constitution.pdf",
    );
  });
});
