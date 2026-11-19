import { describe, expect, it } from "vitest";
import { computeScaledDimensions } from "@/lib/storage/optimize-image";

describe("computeScaledDimensions", () => {
  it("does not upscale images already within bounds", () => {
    expect(computeScaledDimensions(400, 300, 800)).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("scales landscape images to max 800 width", () => {
    expect(computeScaledDimensions(1600, 900, 800)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("scales portrait images to max 800 height", () => {
    expect(computeScaledDimensions(900, 1600, 800)).toEqual({
      width: 450,
      height: 800,
    });
  });

  it("scales square images to 800×800", () => {
    expect(computeScaledDimensions(2000, 2000, 800)).toEqual({
      width: 800,
      height: 800,
    });
  });

  it("rejects invalid dimensions", () => {
    expect(() => computeScaledDimensions(0, 100, 800)).toThrow(
      /greater than zero/i,
    );
  });
});
