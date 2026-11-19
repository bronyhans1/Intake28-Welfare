"use client";

import { updateProfilePhotoAction } from "@/actions/profile";
import { optimizeProfilePhotoImage } from "@/lib/storage/optimize-image";
import {
  buildProfilePhotoStoragePath,
  PROFILE_PHOTO_UNAVAILABLE_MESSAGE,
  validateOptimizedProfilePhotoBlob,
  validateProfilePhotoFile,
} from "@/lib/storage/profile-photo";
import {
  detectProfilePhotoRuntime,
  logProfilePhotoCompressionSummary,
} from "@/lib/storage/profile-photo-log";
import { storageService } from "@/lib/storage/service";
import type { ProfilePhotoUploadProgress } from "@/lib/storage/types";
import { StorageServiceError } from "@/lib/storage/types";

export class ProfilePhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfilePhotoUploadError";
  }
}

export interface ProfilePhotoUploadResult {
  profilePhotoUrl: string;
  profilePhotoPath: string;
}

export interface UploadOptimizedProfilePhotoOptions {
  serviceNumber: string;
  userId: string;
  /** Cropped image File passed into optimize → upload (not the original selection). */
  file: File;
  /** Original user-selected file stats (for development diagnostics only). */
  originalFile?: {
    name: string;
    type: string;
    size: number;
  } | null;
  previousStoragePath?: string | null;
  onProgress?: (progress: ProfilePhotoUploadProgress) => void;
  /**
   * When true (default for crop → upload flow), skip the original ≤5 MB source
   * check. Cropped PNG intermediates often exceed 5 MB even when the selected
   * source was under the limit; size is enforced on the optimized WebP instead.
   */
  skipOriginalSizeValidation?: boolean;
}

function report(
  onProgress: UploadOptimizedProfilePhotoOptions["onProgress"],
  progress: ProfilePhotoUploadProgress,
): void {
  onProgress?.(progress);
}

function logProfilePhotoPipeline(
  stage: string,
  details: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(`[profile-photo:${stage}]`, details);
}

function describeFile(file: File | Blob): Record<string, unknown> {
  return {
    name: file instanceof File ? file.name : "(blob)",
    type: file.type || "(empty)",
    sizeBytes: file.size,
    sizeKb: Number((file.size / 1024).toFixed(1)),
    isFile: file instanceof File,
  };
}

/**
 * Full production profile-photo pipeline:
 * cropped input → optimize (EXIF + resize + WebP) → resumable upload →
 * Firestore update → delete previous object (only after Firestore succeeds).
 *
 * Rolls back the newly uploaded object if Firestore update fails.
 *
 * Size validation for the user-selected original happens before the crop
 * dialog opens. This pipeline must not re-apply that check to the cropped
 * intermediate (lossless PNG can exceed 5 MB).
 */
export async function uploadOptimizedProfilePhoto(
  options: UploadOptimizedProfilePhotoOptions,
): Promise<ProfilePhotoUploadResult> {
  const {
    serviceNumber,
    userId,
    file,
    originalFile,
    previousStoragePath,
    onProgress,
    skipOriginalSizeValidation = true,
  } = options;

  const runtime = detectProfilePhotoRuntime();

  report(onProgress, {
    stage: "preparing",
    message: "Preparing image...",
  });

  logProfilePhotoPipeline("cropped-input", {
    ...runtime,
    serviceNumber,
    userId,
    skipOriginalSizeValidation,
    file: describeFile(file),
    originalFile: originalFile ?? null,
  });

  const validationError = validateProfilePhotoFile(
    file,
    skipOriginalSizeValidation ? "cropped-intermediate" : "original",
  );
  if (validationError) {
    logProfilePhotoPipeline("cropped-input-rejected", {
      reason: validationError,
      file: describeFile(file),
    });
    throw new ProfilePhotoUploadError(validationError);
  }

  let uploadedPath: string | null = null;

  try {
    report(onProgress, {
      stage: "optimizing",
      message: "Optimizing image...",
    });

    const optimized = await optimizeProfilePhotoImage(file);

    logProfilePhotoPipeline("optimized-webp", {
      ...runtime,
      requestedMime: "image/webp",
      cropOutputMime: file.type || "(empty)",
      canvasReturnedMime: optimized.canvasReturnedMime,
      encodeMethod: optimized.encodeMethod,
      finalUploadMime: optimized.blob.type || "(empty)",
      finalFilename: optimized.fileName,
      contentType: optimized.contentType,
      fileName: optimized.fileName,
      width: optimized.width,
      height: optimized.height,
      blob: describeFile(optimized.blob),
    });

    const optimizedValidationError = validateOptimizedProfilePhotoBlob(
      optimized.blob,
    );
    if (optimizedValidationError) {
      logProfilePhotoPipeline("optimized-rejected", {
        reason: optimizedValidationError,
        encodeMethod: optimized.encodeMethod,
        canvasReturnedMime: optimized.canvasReturnedMime,
        blob: describeFile(optimized.blob),
      });
      throw new ProfilePhotoUploadError(optimizedValidationError);
    }

    logProfilePhotoCompressionSummary({
      original: originalFile ?? {
        name: file.name,
        type: file.type,
        size: file.size,
      },
      cropped: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
      uploaded: {
        name: optimized.fileName,
        type: optimized.blob.type,
        size: optimized.blob.size,
      },
      requestedMime: "image/webp",
      cropOutputMime: file.type || "(empty)",
      finalUploadMime: optimized.blob.type || "(empty)",
      finalFilename: optimized.fileName,
      encodeMethod: optimized.encodeMethod,
      canvasReturnedMime: optimized.canvasReturnedMime,
    });

    const profilePhotoPath = buildProfilePhotoStoragePath(serviceNumber);

    report(onProgress, {
      stage: "uploading",
      message: "Uploading... 0%",
      progress: 0,
    });

    logProfilePhotoPipeline("upload-start", {
      storagePath: profilePhotoPath,
      contentType: optimized.contentType,
      sizeBytes: optimized.blob.size,
      finalUploadMime: optimized.blob.type,
      finalFilename: optimized.fileName,
    });

    const uploaded = await storageService.uploadResumable(
      profilePhotoPath,
      optimized.blob,
      {
        contentType: optimized.contentType,
        customMetadata: {
          uploadedBy: userId,
          serviceNumber,
          purpose: "profile-photo",
          optimized: "true",
          width: String(optimized.width),
          height: String(optimized.height),
          encodeMethod: optimized.encodeMethod,
        },
        onProgress: (percent) => {
          report(onProgress, {
            stage: "uploading",
            message: `Uploading... ${percent}%`,
            progress: percent,
          });
        },
      },
    );

    uploadedPath = uploaded.storagePath;

    logProfilePhotoPipeline("upload-complete", {
      storagePath: uploaded.storagePath,
      downloadUrlPresent: Boolean(uploaded.downloadUrl),
    });

    report(onProgress, {
      stage: "saving",
      message: "Saving profile...",
    });

    const result = await updateProfilePhotoAction({
      profilePhotoUrl: uploaded.downloadUrl,
      profilePhotoPath: uploaded.storagePath,
    });

    if (result?.error) {
      await storageService.delete(uploaded.storagePath);
      uploadedPath = null;
      throw new ProfilePhotoUploadError(result.error);
    }

    if (
      previousStoragePath &&
      previousStoragePath !== uploaded.storagePath
    ) {
      report(onProgress, {
        stage: "cleanup",
        message: "Cleaning up previous image...",
      });
      await storageService.delete(previousStoragePath);
    }

    report(onProgress, {
      stage: "complete",
      message: "Upload complete.",
      progress: 100,
    });

    return {
      profilePhotoUrl: uploaded.downloadUrl,
      profilePhotoPath: uploaded.storagePath,
    };
  } catch (error) {
    if (uploadedPath) {
      await storageService.delete(uploadedPath);
    }

    if (error instanceof ProfilePhotoUploadError) {
      throw error;
    }

    if (error instanceof StorageServiceError) {
      throw new ProfilePhotoUploadError(PROFILE_PHOTO_UNAVAILABLE_MESSAGE);
    }

    throw new ProfilePhotoUploadError(
      error instanceof Error
        ? error.message
        : PROFILE_PHOTO_UNAVAILABLE_MESSAGE,
    );
  }
}

/** @deprecated Prefer uploadOptimizedProfilePhoto for the full pipeline. */
export async function uploadProfilePhoto(
  serviceNumber: string,
  userId: string,
  file: File,
): Promise<ProfilePhotoUploadResult> {
  return uploadOptimizedProfilePhoto({
    serviceNumber,
    userId,
    file,
  });
}

export async function deleteProfilePhoto(
  profilePhotoPath: string | null | undefined,
): Promise<void> {
  await storageService.delete(profilePhotoPath);
}

export async function getProfilePhotoDownloadUrl(
  profilePhotoPath: string,
): Promise<string> {
  try {
    return await storageService.getDownloadUrl(profilePhotoPath);
  } catch {
    throw new ProfilePhotoUploadError(PROFILE_PHOTO_UNAVAILABLE_MESSAGE);
  }
}
