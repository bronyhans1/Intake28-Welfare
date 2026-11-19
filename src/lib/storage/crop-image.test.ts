import { describe, expect, it } from "vitest";
import { getRotatedBoundingBox } from "@/lib/storage/crop-image";
import {
  computeCompressionPercent,
  formatProfilePhotoSize,
} from "@/lib/storage/profile-photo-log";

describe("getRotatedBoundingBox", () => {
  it("keeps dimensions unchanged at 0° rotation", () => {
    expect(getRotatedBoundingBox(200, 100, 0)).toEqual({
      width: 200,
      height: 100,
    });
  });

  it("swaps bounding box at 90° rotation", () => {
    const box = getRotatedBoundingBox(200, 100, 90);
    expect(box.width).toBeGreaterThanOrEqual(100);
    expect(box.width).toBeLessThanOrEqual(101);
    expect(box.height).toBeGreaterThanOrEqual(200);
    expect(box.height).toBeLessThanOrEqual(201);
  });

  it("expands bounding box for diagonal rotation", () => {
    const box = getRotatedBoundingBox(100, 100, 45);
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
    expect(box.width).toBe(box.height);
  });
});

describe("profile photo size logging helpers", () => {
  it("formats byte sizes for logs", () => {
    expect(formatProfilePhotoSize(512)).toBe("512 B");
    expect(formatProfilePhotoSize(192 * 1024)).toBe("192 KB");
    expect(formatProfilePhotoSize(1.08 * 1024 * 1024)).toBe("1.08 MB");
  });

  it("computes compression reduction percentage", () => {
    expect(computeCompressionPercent(1_048_576, 181_000)).toBe(83);
    expect(computeCompressionPercent(0, 100)).toBe(0);
  });
});
