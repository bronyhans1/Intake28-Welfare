"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getCroppedImageFile } from "@/lib/storage/crop-image";
import {
  createInitialProfilePhotoCropState,
  isDefaultProfilePhotoCropState,
  PROFILE_PHOTO_CROP_DEFAULTS,
} from "@/lib/storage/crop-defaults";
import { cn } from "@/lib/utils";

interface ProfilePhotoCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

const PREVIEW_DEBOUNCE_MS = 140;

export function ProfilePhotoCropDialog({
  open,
  imageSrc,
  onCancel,
  onConfirm,
}: ProfilePhotoCropDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const zoomId = useId();
  const rotationId = useId();

  const [crop, setCrop] = useState<Point>({ ...PROFILE_PHOTO_CROP_DEFAULTS.crop });
  const [zoom, setZoom] = useState<number>(PROFILE_PHOTO_CROP_DEFAULTS.zoom);
  const [rotation, setRotation] = useState<number>(
    PROFILE_PHOTO_CROP_DEFAULTS.rotation,
  );
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionImageSrcRef = useRef<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  const clearPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const resetCropControls = useCallback(() => {
    const initial = createInitialProfilePhotoCropState();
    setCrop(initial.crop);
    setZoom(initial.zoom);
    setRotation(initial.rotation);
    setCroppedAreaPixels(null);
    setError(null);
    clearPreview();
  }, [clearPreview]);

  // Initialize crop state only for a new image session — never on resize/re-render.
  useEffect(() => {
    if (!open) {
      sessionImageSrcRef.current = null;
      isSavingRef.current = false;
      setIsSaving(false);
      setError(null);
      clearPreview();
      return;
    }

    if (!imageSrc) {
      return;
    }

    if (sessionImageSrcRef.current === imageSrc) {
      return;
    }

    sessionImageSrcRef.current = imageSrc;
    isSavingRef.current = false;
    setIsSaving(false);
    resetCropControls();
  }, [open, imageSrc, clearPreview, resetCropControls]);

  // Prevent background scrolling while the cropper is open.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarGap =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, [clearPreview]);

  const schedulePreview = useCallback(
    (areaPixels: Area, nextRotation: number) => {
      if (!imageSrc) {
        return;
      }

      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }

      previewTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const cropped = await getCroppedImageFile(
              imageSrc,
              areaPixels,
              nextRotation,
            );
            const nextUrl = URL.createObjectURL(cropped.blob);
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current);
            }
            previewUrlRef.current = nextUrl;
            setPreviewUrl(nextUrl);
          } catch {
            // Preview is best-effort; Save & Continue extracts a fresh crop.
          }
        })();
      }, PREVIEW_DEBOUNCE_MS);
    },
    [imageSrc],
  );

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    if (!open || !croppedAreaPixels) {
      return;
    }
    schedulePreview(croppedAreaPixels, rotation);
  }, [open, croppedAreaPixels, rotation, schedulePreview]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSavingRef.current) {
      onCancel();
    }
  }

  function handleReset() {
    if (isSaving) return;
    resetCropControls();
  }

  async function handleSaveAndContinue() {
    if (!imageSrc || !croppedAreaPixels || isSaving) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const cropped = await getCroppedImageFile(
        imageSrc,
        croppedAreaPixels,
        rotation,
      );
      onConfirm(cropped.file);
    } catch (cropError) {
      isSavingRef.current = false;
      setIsSaving(false);
      setError(
        cropError instanceof Error
          ? cropError.message
          : "Unable to crop image. Please try again.",
      );
    }
  }

  const canReset = !isDefaultProfilePhotoCropState({ crop, zoom, rotation });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            "transition-opacity duration-200",
          )}
        />
        <DialogPrimitive.Popup
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[min(100%-1rem,36rem)] max-h-[min(94vh,880px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl outline-none",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "transition-[opacity,transform] duration-200",
          )}
        >
          <div className="border-b border-black/[0.06] px-4 py-4 sm:px-6">
            <DialogPrimitive.Title
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Adjust profile photo
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              id={descriptionId}
              className="mt-1 text-sm text-muted-foreground"
            >
              Drag to reposition, scroll or pinch to zoom. Upload starts only
              after you choose Save &amp; Continue.
            </DialogPrimitive.Description>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl bg-[#0b1220]",
                "h-[min(58vh,26rem)] min-h-[16rem] sm:min-h-[20rem]",
              )}
            >
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  objectFit="contain"
                  minZoom={PROFILE_PHOTO_CROP_DEFAULTS.minZoom}
                  maxZoom={PROFILE_PHOTO_CROP_DEFAULTS.maxZoom}
                  zoomWithScroll
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                  classes={{
                    containerClassName: "rounded-2xl",
                    mediaClassName: "select-none",
                    cropAreaClassName:
                      "border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]",
                  }}
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={zoomId}>Zoom</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {zoom.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    id={zoomId}
                    type="range"
                    min={PROFILE_PHOTO_CROP_DEFAULTS.minZoom}
                    max={PROFILE_PHOTO_CROP_DEFAULTS.maxZoom}
                    step={PROFILE_PHOTO_CROP_DEFAULTS.zoomStep}
                    value={zoom}
                    disabled={isSaving}
                    aria-valuemin={PROFILE_PHOTO_CROP_DEFAULTS.minZoom}
                    aria-valuemax={PROFILE_PHOTO_CROP_DEFAULTS.maxZoom}
                    aria-valuenow={zoom}
                    aria-label="Zoom profile photo"
                    onChange={(event) => setZoom(Number(event.target.value))}
                    className="w-full accent-[#166534]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={rotationId}>Rotation</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {rotation}°
                    </span>
                  </div>
                  <input
                    id={rotationId}
                    type="range"
                    min={0}
                    max={PROFILE_PHOTO_CROP_DEFAULTS.rotationMax}
                    step={PROFILE_PHOTO_CROP_DEFAULTS.rotationStep}
                    value={rotation}
                    disabled={isSaving}
                    aria-valuemin={0}
                    aria-valuemax={PROFILE_PHOTO_CROP_DEFAULTS.rotationMax}
                    aria-valuenow={rotation}
                    aria-label="Rotate profile photo"
                    onChange={(event) =>
                      setRotation(Number(event.target.value))
                    }
                    className="w-full accent-[#166534]"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 sm:items-end">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Avatar preview
                </p>
                <div className="size-24 overflow-hidden rounded-full border-2 border-white bg-muted shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-black/10">
                  {previewUrl ? (
                    // Object URLs are ephemeral crop previews.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Circular avatar preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center px-2 text-center text-[10px] leading-tight text-muted-foreground">
                      Adjust crop to preview
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.06] bg-[#fafafa] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving || !canReset}
              onClick={handleReset}
              className="justify-center sm:justify-start"
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#166534] text-white hover:bg-[#14532d]"
                disabled={isSaving || !croppedAreaPixels}
                onClick={() => void handleSaveAndContinue()}
              >
                {isSaving ? "Preparing…" : "Save & Continue"}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
