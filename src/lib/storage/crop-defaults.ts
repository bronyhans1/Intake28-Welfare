export const PROFILE_PHOTO_CROP_DEFAULTS = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  minZoom: 1,
  maxZoom: 3,
  zoomStep: 0.01,
  rotationMax: 360,
  rotationStep: 1,
} as const;

export type ProfilePhotoCropPoint = {
  x: number;
  y: number;
};

export interface ProfilePhotoCropState {
  crop: ProfilePhotoCropPoint;
  zoom: number;
  rotation: number;
}

export function createInitialProfilePhotoCropState(): ProfilePhotoCropState {
  return {
    crop: { ...PROFILE_PHOTO_CROP_DEFAULTS.crop },
    zoom: PROFILE_PHOTO_CROP_DEFAULTS.zoom,
    rotation: PROFILE_PHOTO_CROP_DEFAULTS.rotation,
  };
}

export function isDefaultProfilePhotoCropState(
  state: ProfilePhotoCropState,
): boolean {
  return (
    state.crop.x === PROFILE_PHOTO_CROP_DEFAULTS.crop.x &&
    state.crop.y === PROFILE_PHOTO_CROP_DEFAULTS.crop.y &&
    state.zoom === PROFILE_PHOTO_CROP_DEFAULTS.zoom &&
    state.rotation === PROFILE_PHOTO_CROP_DEFAULTS.rotation
  );
}
