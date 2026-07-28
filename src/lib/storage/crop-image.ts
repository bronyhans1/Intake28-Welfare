import type { Area } from "react-easy-crop";
import { PROFILE_PHOTO } from "@/lib/constants";
import { isGenuineWebpBlob } from "@/lib/storage/webp-encode";

export interface CroppedImageResult {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  contentType: string;
  /** True when the browser could not encode WebP and PNG was used instead. */
  usedPngFallback: boolean;
}

function toRadian(degree: number): number {
  return (degree * Math.PI) / 180;
}

/**
 * Returns the bounding box size needed to contain a rotated rectangle.
 */
export function getRotatedBoundingBox(
  width: number,
  height: number,
  rotationDegrees: number,
): { width: number; height: number } {
  const radians = toRadian(rotationDegrees);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: Math.ceil(width * cos + height * sin),
    height: Math.ceil(width * sin + height * cos),
  };
}

function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) {
    return;
  }
  canvas.width = 0;
  canvas.height = 0;
}

function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("Unable to load image for cropping.")),
    );
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

async function loadCropSource(imageSrc: string): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  try {
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    const image = await createImageElement(imageSrc);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.src = "";
      },
    };
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Prefer WebP (~80% quality). Fall back to PNG when the browser cannot encode WebP.
 * Crop output may be PNG on iOS; the optimize step still guarantees final WebP upload.
 */
export async function encodeCroppedCanvas(
  canvas: HTMLCanvasElement,
): Promise<{
  blob: Blob;
  contentType: string;
  fileName: string;
  usedPngFallback: boolean;
}> {
  const webpBlob = await canvasToBlob(
    canvas,
    PROFILE_PHOTO.OUTPUT_CONTENT_TYPE,
    PROFILE_PHOTO.WEBP_QUALITY,
  );

  if (webpBlob && (await isGenuineWebpBlob(webpBlob))) {
    const normalized =
      webpBlob.type === PROFILE_PHOTO.OUTPUT_CONTENT_TYPE
        ? webpBlob
        : new Blob([webpBlob], { type: PROFILE_PHOTO.OUTPUT_CONTENT_TYPE });

    return {
      blob: normalized,
      contentType: PROFILE_PHOTO.OUTPUT_CONTENT_TYPE,
      fileName: PROFILE_PHOTO.OUTPUT_FILENAME,
      usedPngFallback: false,
    };
  }

  const pngBlob = await canvasToBlob(canvas, "image/png");
  if (!pngBlob || pngBlob.size <= 0) {
    throw new Error("Unable to extract cropped image.");
  }

  return {
    blob: pngBlob,
    contentType: "image/png",
    fileName: "profile.png",
    usedPngFallback: true,
  };
}

function drawUnrotatedCrop(
  source: CanvasImageSource,
  pixelCrop: Area,
): HTMLCanvasElement {
  const croppedCanvas = document.createElement("canvas");
  const width = Math.round(pixelCrop.width);
  const height = Math.round(pixelCrop.height);
  croppedCanvas.width = width;
  croppedCanvas.height = height;

  const context = croppedCanvas.getContext("2d");
  if (!context) {
    releaseCanvas(croppedCanvas);
    throw new Error("Unable to prepare cropped image canvas.");
  }

  context.drawImage(
    source,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    width,
    height,
    0,
    0,
    width,
    height,
  );

  return croppedCanvas;
}

function drawRotatedCrop(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  pixelCrop: Area,
  rotation: number,
): HTMLCanvasElement {
  const bounding = getRotatedBoundingBox(sourceWidth, sourceHeight, rotation);
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = bounding.width;
  rotatedCanvas.height = bounding.height;

  const rotatedContext = rotatedCanvas.getContext("2d");
  if (!rotatedContext) {
    releaseCanvas(rotatedCanvas);
    throw new Error("Unable to prepare crop canvas.");
  }

  rotatedContext.translate(bounding.width / 2, bounding.height / 2);
  rotatedContext.rotate(toRadian(rotation));
  rotatedContext.translate(-sourceWidth / 2, -sourceHeight / 2);
  rotatedContext.drawImage(source, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const width = Math.round(pixelCrop.width);
  const height = Math.round(pixelCrop.height);
  croppedCanvas.width = width;
  croppedCanvas.height = height;

  const croppedContext = croppedCanvas.getContext("2d");
  if (!croppedContext) {
    releaseCanvas(rotatedCanvas);
    releaseCanvas(croppedCanvas);
    throw new Error("Unable to prepare cropped image canvas.");
  }

  croppedContext.drawImage(
    rotatedCanvas,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    width,
    height,
    0,
    0,
    width,
    height,
  );

  releaseCanvas(rotatedCanvas);
  return croppedCanvas;
}

/**
 * Extracts the cropped (and optionally rotated) pixel area into a File.
 * Prefers image/webp at ~80% quality; falls back to PNG when unsupported.
 * Output continues through the existing optimize → upload pipeline.
 */
export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  fileName?: string,
): Promise<CroppedImageResult> {
  if (pixelCrop.width <= 0 || pixelCrop.height <= 0) {
    throw new Error("Invalid crop area.");
  }

  const loaded = await loadCropSource(imageSrc);
  let croppedCanvas: HTMLCanvasElement | null = null;

  try {
    croppedCanvas =
      rotation === 0
        ? drawUnrotatedCrop(loaded.source, pixelCrop)
        : drawRotatedCrop(
            loaded.source,
            loaded.width,
            loaded.height,
            pixelCrop,
            rotation,
          );

    const encoded = await encodeCroppedCanvas(croppedCanvas);
    const resolvedName = fileName ?? encoded.fileName;
    const file = new File([encoded.blob], resolvedName, {
      type: encoded.contentType,
      lastModified: Date.now(),
    });

    return {
      blob: encoded.blob,
      file,
      width: croppedCanvas.width,
      height: croppedCanvas.height,
      contentType: encoded.contentType,
      usedPngFallback: encoded.usedPngFallback,
    };
  } finally {
    releaseCanvas(croppedCanvas);
    loaded.release();
  }
}
