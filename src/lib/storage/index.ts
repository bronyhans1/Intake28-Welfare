export {
  buildAnnouncementStoragePath,
  buildClaimStoragePath,
  buildConstitutionStoragePath,
  buildProfilePhotoStoragePath,
  buildReceiptStoragePath,
  isProfilePhotoPathForServiceNumber,
  sanitizeStorageServiceNumber,
} from "@/lib/storage/paths";

export {
  computeScaledDimensions,
  optimizeProfilePhotoImage,
} from "@/lib/storage/optimize-image";

export type { OptimizedProfileImage, ScaledImageDimensions } from "@/lib/storage/optimize-image";

export { getCroppedImageFile, getRotatedBoundingBox, encodeCroppedCanvas } from "@/lib/storage/crop-image";
export type { CroppedImageResult } from "@/lib/storage/crop-image";

export {
  computeCompressionPercent,
  detectProfilePhotoRuntime,
  formatProfilePhotoSize,
  logProfilePhotoCompressionSummary,
} from "@/lib/storage/profile-photo-log";
export type {
  ProfilePhotoRuntimeDiagnostics,
  ProfilePhotoSizeStats,
} from "@/lib/storage/profile-photo-log";

export {
  encodeCanvasToGuaranteedWebp,
  isGenuineWebpBlob,
} from "@/lib/storage/webp-encode";
export type {
  WebpEncodeMethod,
  WebpEncodeResult,
} from "@/lib/storage/webp-encode";

export {
  createInitialProfilePhotoCropState,
  isDefaultProfilePhotoCropState,
  PROFILE_PHOTO_CROP_DEFAULTS,
} from "@/lib/storage/crop-defaults";
export type {
  ProfilePhotoCropPoint,
  ProfilePhotoCropState,
} from "@/lib/storage/crop-defaults";

export {
  assertProfilePhotoPathOwnership,
  buildMemberProfilePhotoPath,
  getAcceptedProfilePhotoMimeTypes,
  getProfilePhotoMaxSizeBytes,
  getProfilePhotoUrl,
  isProfilePhotoStorageEnabled,
  PROFILE_PHOTO_FILENAME,
  PROFILE_PHOTO_UNAVAILABLE_MESSAGE,
  resolveProfilePhotoExtension,
  validateOptimizedProfilePhotoBlob,
  validateProfilePhotoFile,
} from "@/lib/storage/profile-photo";

export type {
  ProfilePhotoUploadProgress,
  ProfilePhotoUploadStage,
  StorageFileConstraints,
  StorageUploadOptions,
  StorageUploadResult,
} from "@/lib/storage/types";

export { StorageServiceError } from "@/lib/storage/types";
