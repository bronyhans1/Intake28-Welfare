import { describe, expect, it } from "vitest";
import {
  buildAnnouncementStoragePath,
  buildClaimStoragePath,
  buildConstitutionStoragePath,
  buildProfilePhotoStoragePath,
  buildReceiptStoragePath,
  isProfilePhotoPathForServiceNumber,
  sanitizeStorageServiceNumber,
} from "@/lib/storage/paths";
import {
  assertProfilePhotoPathOwnership,
  getProfilePhotoUrl,
  validateOptimizedProfilePhotoBlob,
  validateProfilePhotoFile,
} from "@/lib/storage/profile-photo";

describe("storage path builders", () => {
  it("sanitizes service numbers for folder names", () => {
    expect(sanitizeStorageServiceNumber("IS/13984")).toBe("IS13984");
    expect(sanitizeStorageServiceNumber("13984")).toBe("IS13984");
  });

  it("builds profile photo paths as profile-photos/{serviceNumber}/profile.webp", () => {
    expect(buildProfilePhotoStoragePath("IS/13984")).toBe(
      "profile-photos/IS13984/profile.webp",
    );
  });

  it("builds receipts, claims, announcements, and constitution folders", () => {
    expect(buildReceiptStoragePath(2026, "receipt-1.pdf")).toBe(
      "receipts/2026/receipt-1.pdf",
    );
    expect(buildClaimStoragePath("IS/13984", "claim.pdf")).toBe(
      "claims/IS13984/claim.pdf",
    );
    expect(buildAnnouncementStoragePath("notice.pdf")).toBe(
      "announcements/notice.pdf",
    );
    expect(buildConstitutionStoragePath("constitution.pdf")).toBe(
      "constitution/constitution.pdf",
    );
  });

  it("validates profile photo path ownership by service number", () => {
    expect(
      isProfilePhotoPathForServiceNumber(
        "profile-photos/IS13984/profile.webp",
        "IS/13984",
      ),
    ).toBe(true);
    expect(
      isProfilePhotoPathForServiceNumber(
        "profile-photos/IS13984/profile.jpg",
        "IS/13984",
      ),
    ).toBe(true);
    expect(
      isProfilePhotoPathForServiceNumber(
        "profile-photos/IS13999/profile.webp",
        "IS/13984",
      ),
    ).toBe(false);
    expect(() =>
      assertProfilePhotoPathOwnership(
        "profile-photos/IS13999/profile.webp",
        "IS/13984",
      ),
    ).toThrow("Invalid profile photo storage path.");
  });
});

describe("profile photo helpers", () => {
  it("returns profile photo URLs when present", () => {
    expect(getProfilePhotoUrl("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg",
    );
    expect(getProfilePhotoUrl("")).toBeNull();
  });

  it("rejects unsupported formats and oversized files when storage is enabled", () => {
    process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED = "true";

    expect(
      validateProfilePhotoFile({
        type: "image/gif",
        size: 1024,
      } as File),
    ).toBe("Upload a JPG, PNG, or WebP image.");

    expect(
      validateProfilePhotoFile({
        type: "image/jpeg",
        size: 6 * 1024 * 1024,
      } as File),
    ).toBe("Profile photo must be 5 MB or smaller.");
  });

  it("does not apply the 5 MB original-size check to cropped intermediates", () => {
    process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED = "true";

    expect(
      validateProfilePhotoFile(
        {
          type: "image/png",
          size: 8 * 1024 * 1024,
          name: "cropped-profile.png",
        } as File,
        "cropped-intermediate",
      ),
    ).toBeNull();

    expect(
      validateProfilePhotoFile(
        {
          type: "image/png",
          size: 0,
          name: "cropped-profile.png",
        } as File,
        "cropped-intermediate",
      ),
    ).toBe("Cropped image is empty. Please try again.");
  });

  it("validates optimized WebP blob size before upload", () => {
    expect(
      validateOptimizedProfilePhotoBlob({
        type: "image/webp",
        size: 120_000,
      } as Blob),
    ).toBeNull();

    expect(
      validateOptimizedProfilePhotoBlob({
        type: "image/webp",
        size: 6 * 1024 * 1024,
      } as Blob),
    ).toBe("Optimized profile photo exceeds the 5 MB upload limit.");
  });

  it("rejects invalid files when storage is disabled", () => {
    const previousFlag = process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED;
    const previousBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED;
    delete process.env.PROFILE_PHOTO_STORAGE_ENABLED;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    const file = {
      type: "image/png",
      size: 1024,
    } as File;

    expect(validateProfilePhotoFile(file)).toBe(
      "Profile photo uploads are temporarily unavailable.",
    );

    if (previousFlag === undefined) {
      delete process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED = previousFlag;
    }

    if (previousBucket === undefined) {
      delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    } else {
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = previousBucket;
    }
  });
});
