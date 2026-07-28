import { describe, expect, it } from "vitest";
import { isGenuineWebpBlob } from "@/lib/storage/webp-encode";
import { detectProfilePhotoRuntime } from "@/lib/storage/profile-photo-log";

function bytesToBlob(bytes: number[], type = ""): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

describe("isGenuineWebpBlob", () => {
  it("accepts RIFF/WEBP magic bytes regardless of MIME", async () => {
    // RIFF....WEBP (size bytes are placeholders)
    const webp = bytesToBlob(
      [
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        0x00,
      ],
      "image/png",
    );
    expect(await isGenuineWebpBlob(webp)).toBe(true);
  });

  it("rejects PNG magic bytes even when MIME claims WebP", async () => {
    const png = bytesToBlob(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00],
      "image/webp",
    );
    expect(await isGenuineWebpBlob(png)).toBe(false);
  });

  it("rejects blobs that are too short", async () => {
    expect(await isGenuineWebpBlob(bytesToBlob([0x52, 0x49, 0x46, 0x46]))).toBe(
      false,
    );
  });
});

describe("detectProfilePhotoRuntime", () => {
  it("reports a platform and engine shape in test environments", () => {
    const runtime = detectProfilePhotoRuntime();
    expect(runtime).toEqual(
      expect.objectContaining({
        platform: expect.any(String),
        engine: expect.any(String),
        userAgent: expect.any(String),
      }),
    );
  });
});
