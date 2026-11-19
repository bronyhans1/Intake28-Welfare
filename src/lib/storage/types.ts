export interface StorageUploadResult {
  downloadUrl: string;
  storagePath: string;
}

export interface StorageUploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
  /** When true, overwrites an existing object at the same path. Default: true */
  overwrite?: boolean;
  /** Called with 0–100 progress for resumable uploads */
  onProgress?: (progressPercent: number) => void;
}

export interface StorageFileConstraints {
  maxSizeBytes: number;
  acceptedMimeTypes: readonly string[];
}

export class StorageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageServiceError";
  }
}

export type ProfilePhotoUploadStage =
  | "preparing"
  | "optimizing"
  | "uploading"
  | "saving"
  | "cleanup"
  | "complete";

export interface ProfilePhotoUploadProgress {
  stage: ProfilePhotoUploadStage;
  message: string;
  /** Present during the uploading stage (0–100) */
  progress?: number;
}
