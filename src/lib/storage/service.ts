"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
  type UploadMetadata,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import type {
  StorageFileConstraints,
  StorageUploadOptions,
  StorageUploadResult,
} from "@/lib/storage/types";
import { StorageServiceError } from "@/lib/storage/types";

function assertNonEmptyPath(storagePath: string): string {
  const trimmed = storagePath.trim();
  if (!trimmed) {
    throw new StorageServiceError("Storage path is required.");
  }
  return trimmed;
}

function buildUploadMetadata(options: StorageUploadOptions): UploadMetadata {
  const metadata: UploadMetadata = {};

  if (options.contentType) {
    metadata.contentType = options.contentType;
  }

  if (options.customMetadata) {
    metadata.customMetadata = options.customMetadata;
  }

  return metadata;
}

export function validateStorageFile(
  file: File,
  constraints: StorageFileConstraints,
): string | null {
  if (!constraints.acceptedMimeTypes.includes(file.type as never)) {
    return "Unsupported file type.";
  }

  if (file.size > constraints.maxSizeBytes) {
    return `File must be ${Math.floor(constraints.maxSizeBytes / (1024 * 1024))} MB or smaller.`;
  }

  return null;
}

/**
 * Reusable Firebase Storage client service for uploads, downloads, and deletions.
 * Compatible with the existing Firebase Auth session (client SDK).
 */
export const storageService = {
  async upload(
    storagePath: string,
    file: Blob | Uint8Array | ArrayBuffer,
    options: StorageUploadOptions = {},
  ): Promise<StorageUploadResult> {
    const path = assertNonEmptyPath(storagePath);

    try {
      const storageRef = ref(getFirebaseStorage(), path);
      await uploadBytes(storageRef, file, buildUploadMetadata(options));
      const downloadUrl = await getDownloadURL(storageRef);

      return { downloadUrl, storagePath: path };
    } catch (error) {
      if (error instanceof StorageServiceError) {
        throw error;
      }

      throw new StorageServiceError(
        "Unable to upload file to Firebase Storage. Please try again.",
      );
    }
  },

  /**
   * Resumable upload with live progress (0–100). Prefer this for user-facing uploads.
   */
  async uploadResumable(
    storagePath: string,
    file: Blob | Uint8Array | ArrayBuffer,
    options: StorageUploadOptions = {},
  ): Promise<StorageUploadResult> {
    const path = assertNonEmptyPath(storagePath);
    const storageRef = ref(getFirebaseStorage(), path);
    const task = uploadBytesResumable(storageRef, file, buildUploadMetadata(options));

    return new Promise<StorageUploadResult>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          if (!options.onProgress || snapshot.totalBytes <= 0) {
            return;
          }

          const percent = Math.min(
            100,
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          );
          options.onProgress(percent);
        },
        () => {
          reject(
            new StorageServiceError(
              "Unable to upload file to Firebase Storage. Please try again.",
            ),
          );
        },
        async () => {
          try {
            options.onProgress?.(100);
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve({ downloadUrl, storagePath: path });
          } catch {
            reject(
              new StorageServiceError("Unable to resolve storage download URL."),
            );
          }
        },
      );
    });
  },

  async getDownloadUrl(storagePath: string): Promise<string> {
    const path = assertNonEmptyPath(storagePath);

    try {
      return await getDownloadURL(ref(getFirebaseStorage(), path));
    } catch {
      throw new StorageServiceError("Unable to resolve storage download URL.");
    }
  },

  async delete(storagePath: string | null | undefined): Promise<void> {
    if (!storagePath?.trim()) {
      return;
    }

    try {
      await deleteObject(ref(getFirebaseStorage(), storagePath.trim()));
    } catch {
      // Best-effort cleanup — missing objects or billing gaps must not break UX.
    }
  },
};

export type StorageService = typeof storageService;
