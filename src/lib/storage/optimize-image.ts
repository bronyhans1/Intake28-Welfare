import { PROFILE_PHOTO } from "@/lib/constants";
import { encodeCanvasToGuaranteedWebp } from "@/lib/storage/webp-encode";

export interface ScaledImageDimensions {
  width: number;
  height: number;
}

export interface OptimizedProfileImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: typeof PROFILE_PHOTO.OUTPUT_CONTENT_TYPE;
  fileName: typeof PROFILE_PHOTO.OUTPUT_FILENAME;
  /** How the final WebP bytes were produced. */
  encodeMethod: "canvas" | "wasm-fallback";
  /** MIME returned by the browser's canvas.toBlob attempt before fallback. */
  canvasReturnedMime: string;
}

/**
 * Scales dimensions down to fit within maxDimension while preserving aspect ratio.
 * Never upscales.
 */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number = PROFILE_PHOTO.MAX_DIMENSION,
): ScaledImageDimensions {
  if (width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be greater than zero.");
  }

  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadOrientedBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    // Fallback for environments that reject orientation options.
    return createImageBitmap(file);
  }
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Corrects EXIF orientation, resizes to max 800×800 (aspect preserved),
 * and converts to a verified WebP at ~80% quality.
 *
 * On iOS/WebKit, canvas WebP encoding is unreliable — a WASM libwebp
 * fallback guarantees genuine WebP bytes before upload validation.
 */
export async function optimizeProfilePhotoImage(
  file: File,
): Promise<OptimizedProfileImage> {
  const bitmap = await loadOrientedBitmap(file);
  let canvas: HTMLCanvasElement | null = null;

  try {
    const scaled = computeScaledDimensions(
      bitmap.width,
      bitmap.height,
      PROFILE_PHOTO.MAX_DIMENSION,
    );

    canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare image canvas.");
    }

    context.drawImage(bitmap, 0, 0, scaled.width, scaled.height);

    const encoded = await encodeCanvasToGuaranteedWebp(
      canvas,
      PROFILE_PHOTO.WEBP_QUALITY,
    );

    return {
      blob: encoded.blob,
      width: scaled.width,
      height: scaled.height,
      contentType: PROFILE_PHOTO.OUTPUT_CONTENT_TYPE,
      fileName: PROFILE_PHOTO.OUTPUT_FILENAME,
      encodeMethod: encoded.method,
      canvasReturnedMime: encoded.returnedMime,
    };
  } finally {
    bitmap.close();
    if (canvas) {
      releaseCanvas(canvas);
    }
  }
}
