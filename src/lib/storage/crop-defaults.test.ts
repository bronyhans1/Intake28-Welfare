import { describe, expect, it } from "vitest";
import {
  createInitialProfilePhotoCropState,
  isDefaultProfilePhotoCropState,
  PROFILE_PHOTO_CROP_DEFAULTS,
} from "@/lib/storage/crop-defaults";

describe("profile photo crop defaults", () => {
  it("creates the initial centered crop state", () => {
    expect(createInitialProfilePhotoCropState()).toEqual({
      crop: PROFILE_PHOTO_CROP_DEFAULTS.crop,
      zoom: 1,
      rotation: 0,
    });
  });

  it("detects default versus adjusted crop state", () => {
    expect(
      isDefaultProfilePhotoCropState(createInitialProfilePhotoCropState()),
    ).toBe(true);

    expect(
      isDefaultProfilePhotoCropState({
        crop: { x: 12, y: 0 },
        zoom: 1,
        rotation: 0,
      }),
    ).toBe(false);

    expect(
      isDefaultProfilePhotoCropState({
        crop: { x: 0, y: 0 },
        zoom: 1.5,
        rotation: 0,
      }),
    ).toBe(false);
  });
});
