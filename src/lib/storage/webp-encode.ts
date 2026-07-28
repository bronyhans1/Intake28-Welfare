import { PROFILE_PHOTO } from "@/lib/constants";

export type WebpEncodeMethod = "canvas" | "wasm-fallback";

export interface WebpEncodeResult {
  blob: Blob;
  method: WebpEncodeMethod;
  requestedMime: typeof PROFILE_PHOTO.OUTPUT_CONTENT_TYPE;
  returnedMime: string;
}

const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const; // RIFF
const WEBP_FOURCC = [0x57, 0x45, 0x42, 0x50] as const; // WEBP

type PublicWebpEncoderModule = {
  default: (
    imageData: ImageData,
    options?: { quality?: number },
  ) => Promise<ArrayBuffer>;
};

/**
 * Verifies a Blob is genuine WebP by RIFF/WEBP magic bytes.
 * WebKit may return PNG bytes while claiming various MIME types.
 */
export async function isGenuineWebpBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 12) {
    return false;
  }

  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const isRiff =
    header[0] === WEBP_RIFF[0] &&
    header[1] === WEBP_RIFF[1] &&
    header[2] === WEBP_RIFF[2] &&
    header[3] === WEBP_RIFF[3];
  const isWebpFourCc =
    header[8] === WEBP_FOURCC[0] &&
    header[9] === WEBP_FOURCC[1] &&
    header[10] === WEBP_FOURCC[2] &&
    header[11] === WEBP_FOURCC[3];

  return isRiff && isWebpFourCc;
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
 * Loads the vendored encoder from /public/wasm so Next.js Turbopack/SWC never
 * transforms the Emscripten glue (that transform caused the Module let/var
 * SyntaxError on iOS WebKit).
 */
async function loadPublicWebpEncoder(): Promise<PublicWebpEncoderModule> {
  if (typeof window === "undefined") {
    throw new Error("WebP WASM fallback is only available in the browser.");
  }

  const encoderUrl = new URL("/wasm/encode-webp.js", window.location.origin)
    .href;

  // webpackIgnore / turbopackIgnore: keep this as a runtime URL import so the
  // bundler does not parse or rewrite public/wasm/webp_enc.js.
  return import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    encoderUrl
  ) as Promise<PublicWebpEncoderModule>;
}

async function encodeWebpWithWasm(
  imageData: ImageData,
  quality: number,
): Promise<Blob> {
  const encoder = await loadPublicWebpEncoder();
  const buffer = await encoder.default(imageData, {
    quality: Math.round(Math.min(100, Math.max(0, quality * 100))),
  });

  return new Blob([new Uint8Array(buffer)], {
    type: PROFILE_PHOTO.OUTPUT_CONTENT_TYPE,
  });
}

/**
 * Produces a guaranteed WebP Blob from a canvas.
 *
 * 1. Try native canvas.toBlob("image/webp")
 * 2. Verify RIFF/WEBP magic bytes (WebKit often returns PNG here)
 * 3. If native encoding fails, encode via vendored libwebp WASM
 */
export async function encodeCanvasToGuaranteedWebp(
  canvas: HTMLCanvasElement,
  quality: number = PROFILE_PHOTO.WEBP_QUALITY,
): Promise<WebpEncodeResult> {
  const requestedMime = PROFILE_PHOTO.OUTPUT_CONTENT_TYPE;
  const canvasBlob = await canvasToBlob(canvas, requestedMime, quality);

  if (canvasBlob && (await isGenuineWebpBlob(canvasBlob))) {
    const normalized =
      canvasBlob.type === requestedMime
        ? canvasBlob
        : new Blob([canvasBlob], { type: requestedMime });

    return {
      blob: normalized,
      method: "canvas",
      requestedMime,
      returnedMime: canvasBlob.type || "(empty)",
    };
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to read image data for WebP encoding.");
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const wasmBlob = await encodeWebpWithWasm(imageData, quality);

  if (!(await isGenuineWebpBlob(wasmBlob))) {
    throw new Error(
      "Unable to produce a valid WebP image on this device. Please try again or use a different browser.",
    );
  }

  return {
    blob: wasmBlob,
    method: "wasm-fallback",
    requestedMime,
    returnedMime: canvasBlob?.type || "(null)",
  };
}
