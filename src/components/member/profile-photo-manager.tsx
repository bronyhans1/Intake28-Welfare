"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { removeProfilePhotoAction } from "@/actions/profile";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { ProfilePhotoCropDialog } from "@/components/member/profile-photo-crop-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { LoadingButton } from "@/components/ui/loading-button";
import { PROFILE_PHOTO } from "@/lib/constants";
import {
  deleteProfilePhoto,
  uploadOptimizedProfilePhoto,
} from "@/lib/storage/profile-photo-client";
import {
  isProfilePhotoStorageEnabled,
  PROFILE_PHOTO_UNAVAILABLE_MESSAGE,
  validateProfilePhotoFile,
} from "@/lib/storage/profile-photo";
import type { ProfilePhotoUploadProgress } from "@/lib/storage/types";

interface ProfilePhotoManagerProps {
  memberId: string;
  serviceNumber: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  profilePhotoPath?: string | null;
  storageEnabled?: boolean;
}

/**
 * Profile photo upload flow (safe cleanup):
 * 1. Crop image (1:1 circular)
 * 2. Optimize image (EXIF, resize, WebP)
 * 3. Resumable upload to Firebase Storage with progress
 * 4. Persist profilePhotoUrl + profilePhotoPath on Firestore
 * 5. Delete the previous storage object only after Firestore succeeds
 */
export function ProfilePhotoManager({
  memberId,
  serviceNumber,
  fullName,
  profilePhotoUrl,
  profilePhotoPath,
  storageEnabled = isProfilePhotoStorageEnabled(),
}: ProfilePhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const cropObjectUrlRef = useRef<string | null>(null);
  const originalFileStatsRef = useRef<{
    name: string;
    type: string;
    size: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProfilePhotoUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const hasPhoto = Boolean(profilePhotoUrl);
  const previousStoragePath = profilePhotoPath ?? null;
  const isCropping = Boolean(cropImageSrc);
  const busy = isUploading || isRemoving || isCropping;
  const uploadProgress =
    status?.stage === "uploading" ? (status.progress ?? 0) : null;

  function clearCropSession() {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
    setCropImageSrc(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function openFilePicker() {
    if (!storageEnabled) {
      setError(PROFILE_PHOTO_UNAVAILABLE_MESSAGE);
      showError(PROFILE_PHOTO_UNAVAILABLE_MESSAGE);
      return;
    }

    if (uploadInFlightRef.current || busy) {
      return;
    }

    inputRef.current?.click();
  }

  function handleFileSelected(file: File | undefined) {
    if (!file) return;
    if (uploadInFlightRef.current || isUploading || isCropping) return;

    const validationError = validateProfilePhotoFile(file);
    if (validationError) {
      setError(validationError);
      showError(validationError);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[profile-photo:original-selection]", {
        name: file.name,
        type: file.type,
        sizeBytes: file.size,
        sizeKb: Number((file.size / 1024).toFixed(1)),
      });
    }

    setError(null);
    setStatus(null);

    originalFileStatsRef.current = {
      name: file.name,
      type: file.type,
      size: file.size,
    };

    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setCropImageSrc(objectUrl);
  }

  async function startUpload(croppedFile: File) {
    if (uploadInFlightRef.current) return;

    const originalFile = originalFileStatsRef.current;

    clearCropSession();

    uploadInFlightRef.current = true;
    setIsUploading(true);
    setError(null);
    setStatus({
      stage: "preparing",
      message: "Preparing image...",
    });

    try {
      await uploadOptimizedProfilePhoto({
        serviceNumber,
        userId: memberId,
        file: croppedFile,
        originalFile,
        previousStoragePath,
        onProgress: setStatus,
        skipOriginalSizeValidation: true,
      });

      const successMessage = hasPhoto
        ? "Profile photo updated successfully"
        : "Profile photo uploaded successfully";
      showSuccess(successMessage);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : PROFILE_PHOTO_UNAVAILABLE_MESSAGE;
      setError(message);
      setStatus(null);
      showError(message);
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  }

  function handleCropCancel() {
    if (isUploading) return;
    originalFileStatsRef.current = null;
    clearCropSession();
  }

  function handleCropConfirm(croppedFile: File) {
    void startUpload(croppedFile);
  }

  async function handleRemovePhoto() {
    if (uploadInFlightRef.current || busy) return;

    setError(null);
    setStatus(null);
    setIsRemoving(true);

    try {
      const result = await removeProfilePhotoAction();
      if (result?.error) {
        setError(result.error);
        showError(result.error);
        return;
      }

      await deleteProfilePhoto(previousStoragePath);
      showSuccess("Profile photo removed successfully");
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove profile photo.";
      setError(message);
      showError(message);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <MemberAvatar
        fullName={fullName}
        profilePhotoUrl={profilePhotoUrl}
        className="size-28"
      />

      <input
        ref={inputRef}
        type="file"
        accept={PROFILE_PHOTO.ACCEPTED_MIME_TYPES.join(",")}
        className="hidden"
        disabled={busy}
        onChange={(event) => handleFileSelected(event.target.files?.[0])}
      />

      <div className="flex flex-wrap justify-center gap-2">
        {!hasPhoto ? (
          <LoadingButton
            type="button"
            variant="outline"
            size="sm"
            onClick={openFilePicker}
            loading={isUploading}
            loadingText="Uploading…"
            disabled={busy || !storageEnabled}
          >
            <Upload className="size-4" />
            Upload Photo
          </LoadingButton>
        ) : (
          <>
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
              loading={isUploading}
              loadingText="Uploading…"
              disabled={busy || !storageEnabled}
            >
              <Camera className="size-4" />
              Change Photo
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRemovePhoto()}
              loading={isRemoving}
              loadingText="Removing…"
              disabled={busy}
            >
              <Trash2 className="size-4" />
              Remove Photo
            </LoadingButton>
          </>
        )}
      </div>

      {isCropping ? (
        <p className="text-sm text-muted-foreground">
          Adjust your crop, then choose Save &amp; Continue to upload.
        </p>
      ) : null}

      {isUploading && status ? (
        <div className="w-full max-w-xs space-y-2">
          <p className="text-sm font-medium text-[#166534]">{status.message}</p>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={uploadProgress ?? undefined}
            aria-label="Profile photo upload progress"
          >
            <div
              className="h-full rounded-full bg-[#166534] transition-[width] duration-200 ease-out"
              style={{
                width: `${
                  uploadProgress !== null
                    ? uploadProgress
                    : status.stage === "complete"
                      ? 100
                      : status.stage === "saving" || status.stage === "cleanup"
                        ? 95
                        : status.stage === "optimizing"
                          ? 15
                          : 5
                }%`,
              }}
            />
          </div>
          {uploadProgress !== null ? (
            <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        JPG, PNG, or WebP up to 5 MB. Crop to a circular avatar first — upload
        begins only after Save &amp; Continue.
      </p>

      {!storageEnabled ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {PROFILE_PHOTO_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <ProfilePhotoCropDialog
        open={isCropping}
        imageSrc={cropImageSrc}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
