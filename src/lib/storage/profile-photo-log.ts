export interface ProfilePhotoSizeStats {
  name?: string;
  type: string;
  size: number;
}

export interface ProfilePhotoRuntimeDiagnostics {
  platform: string;
  engine: string;
  userAgent: string;
}

export function formatProfilePhotoSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 100 ? Math.round(kb) : Number(kb.toFixed(kb >= 10 ? 0 : 1))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function computeCompressionPercent(
  originalBytes: number,
  finalBytes: number,
): number {
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) {
    return 0;
  }

  const reduction = (1 - finalBytes / originalBytes) * 100;
  return Math.max(0, Math.round(reduction));
}

export function detectProfilePhotoRuntime(): ProfilePhotoRuntimeDiagnostics {
  if (typeof navigator === "undefined") {
    return {
      platform: "server",
      engine: "unknown",
      userAgent: "",
    };
  }

  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? "iPhone"
    : /Android/i.test(ua)
      ? "Android"
      : /Mac/i.test(ua)
        ? "macOS"
        : /Win/i.test(ua)
          ? "Windows"
          : navigator.platform || "unknown";

  // Chrome/Firefox/Edge on iOS are all WebKit-based.
  const engine = /AppleWebKit/i.test(ua)
    ? "WebKit"
    : /Gecko\//i.test(ua)
      ? "Gecko"
      : /Chrome\//i.test(ua)
        ? "Blink"
        : "unknown";

  return { platform, engine, userAgent: ua };
}

export function logProfilePhotoCompressionSummary(input: {
  original: ProfilePhotoSizeStats;
  cropped: ProfilePhotoSizeStats;
  uploaded: ProfilePhotoSizeStats;
  requestedMime?: string;
  cropOutputMime?: string;
  finalUploadMime?: string;
  finalFilename?: string;
  encodeMethod?: string;
  canvasReturnedMime?: string;
}): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const runtime = detectProfilePhotoRuntime();
  const reduction = computeCompressionPercent(
    input.original.size,
    input.uploaded.size,
  );

  const cropOutput =
    input.cropOutputMime ?? (input.cropped.type || "unknown");
  const finalUpload =
    input.finalUploadMime ?? (input.uploaded.type || "unknown");
  const finalFilename =
    input.finalFilename ?? input.uploaded.name ?? "profile.webp";

  console.info(
    [
      "[profile-photo]",
      `Platform: ${runtime.platform}`,
      `Engine: ${runtime.engine}`,
      `Requested: ${input.requestedMime ?? "image/webp"}`,
      `Crop Output: ${cropOutput}`,
      `Canvas Returned: ${input.canvasReturnedMime ?? "n/a"}`,
      `Encode Method: ${input.encodeMethod ?? "n/a"}`,
      `Final Upload: ${finalUpload}`,
      `Final Filename: ${finalFilename}`,
      `Original: ${input.original.type || "unknown"} ${formatProfilePhotoSize(input.original.size)}`,
      `Cropped: ${input.cropped.type || "unknown"} ${formatProfilePhotoSize(input.cropped.size)}`,
      `Uploaded: ${input.uploaded.type || "unknown"} ${formatProfilePhotoSize(input.uploaded.size)}`,
      `Reduction: ${reduction}%`,
    ].join("\n"),
  );
}
