/**
 * Standalone WebP encoder for browsers where canvas.toBlob("image/webp") fails
 * (notably iOS WebKit). Loaded from /public so Next/Turbopack never transforms
 * the Emscripten glue (avoids Module let/var shadow SyntaxError).
 */
import createModule from "./webp_enc.js";

const defaultOptions = {
  quality: 80,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
};

let modulePromise;

export async function init(moduleOptionOverrides = {}) {
  if (!modulePromise) {
    modulePromise = createModule({
      noInitialRun: true,
      locateFile: (file) => `/wasm/${file}`,
      ...moduleOptionOverrides,
    });
  }
  return modulePromise;
}

export default async function encode(imageData, options = {}) {
  const module = await init();
  const merged = { ...defaultOptions, ...options };
  const result = module.encode(
    imageData.data,
    imageData.width,
    imageData.height,
    merged,
  );
  if (!result) {
    throw new Error("WebP encoding failed.");
  }
  return result.buffer;
}
