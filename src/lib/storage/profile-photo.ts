import { PROFILE_PHOTO } from "@/lib/constants";
import {
  buildProfilePhotoStoragePath,
  isProfilePhotoPathForServiceNumber,
} from "@/lib/storage/paths";

export const PROFILE_PHOTO_UNAVAILABLE_MESSAGE =
  "Profile photo uploads are temporarily unavailable." as const;

export const PROFILE_PHOTO_FILENAME = PROFILE_PHOTO.OUTPUT_FILENAME;

export {
  buildProfilePhotoStoragePath,
  isProfilePhotoPathForServiceNumber,
} from "@/lib/storage/paths";

/**
 * Storage is enabled when explicitly flagged, or when the Firebase Storage
 * bucket is configured for the existing Firebase project.
 */
export function isProfilePhotoStorageEnabled(): boolean {
  if (
    process.env.PROFILE_PHOTO_STORAGE_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_PROFILE_PHOTO_STORAGE_ENABLED === "true"
  ) {
    return true;
  }

  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim());
}

export function getAcceptedProfilePhotoMimeTypes(): readonly string[] {
  return PROFILE_PHOTO.ACCEPTED_MIME_TYPES;
}

export function getProfilePhotoMaxSizeBytes(): number {
  return PROFILE_PHOTO.MAX_SIZE_BYTES;
}

export type ProfilePhotoValidationMode = "original" | "cropped-intermediate";

/**
 * Validates a profile photo File.
 *
 * - `original`: used on user selection (type + ≤5 MB).
 * - `cropped-intermediate`: used after crop, before optimize. Size is NOT
 *   checked here because lossless crop canvases (PNG) can exceed 5 MB even
 *   when the source JPEG/WebP was under the limit. Size is enforced again on
 *   the optimized WebP output before upload.
 */
export function validateProfilePhotoFile(
  file: File,
  mode: ProfilePhotoValidationMode = "original",
): string | null {
  if (!isProfilePhotoStorageEnabled()) {
    return PROFILE_PHOTO_UNAVAILABLE_MESSAGE;
  }

  if (!file.type || !PROFILE_PHOTO.ACCEPTED_MIME_TYPES.includes(file.type as never)) {
    return "Upload a JPG, PNG, or WebP image.";
  }

  if (mode === "original" && file.size > PROFILE_PHOTO.MAX_SIZE_BYTES) {
    return "Profile photo must be 5 MB or smaller.";
  }

  if (mode === "cropped-intermediate" && file.size <= 0) {
    return "Cropped image is empty. Please try again.";
  }

  return null;
}

export function validateOptimizedProfilePhotoBlob(blob: Blob): string | null {
  if (blob.size <= 0) {
    return "Optimized image is empty. Please try again.";
  }

  if (blob.size > PROFILE_PHOTO.MAX_SIZE_BYTES) {
    return "Optimized profile photo exceeds the 5 MB upload limit.";
  }

  if (blob.type && blob.type !== PROFILE_PHOTO.OUTPUT_CONTENT_TYPE) {
    return "Optimized profile photo must be WebP.";
  }

  return null;
}

export function getProfilePhotoUrl(
  profilePhotoUrl: string | null | undefined,
): string | null {
  if (typeof profilePhotoUrl !== "string") {
    return null;
  }

  const trimmed = profilePhotoUrl.trim();
  return trimmed || null;
}

/** @deprecated Output is always WebP — kept for compatibility with older callers. */
export function resolveProfilePhotoExtension(_file?: File): string {
  return PROFILE_PHOTO.OUTPUT_EXTENSION;
}

export function assertProfilePhotoPathOwnership(
  storagePath: string,
  serviceNumber: string,
): void {
  if (!isProfilePhotoPathForServiceNumber(storagePath, serviceNumber)) {
    throw new Error("Invalid profile photo storage path.");
  }
}

export function buildMemberProfilePhotoPath(serviceNumber: string): string {
  return buildProfilePhotoStoragePath(serviceNumber);
}
