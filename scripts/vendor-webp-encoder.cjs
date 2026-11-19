/**
 * Vendors a Turbopack/SWC-safe WebP encoder into public/wasm.
 *
 * Root cause of the iPhone crash:
 * @jsquash/webp's Emscripten glue uses:
 *   function(Module = {}) { var Module = ... }
 * Next.js Turbopack/SWC rewrites default params to `let Module`, which then
 * conflicts with the inner `var Module` → SyntaxError on WebKit.
 *
 * Fix: serve a patched encoder from /public so the bundler never touches it.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcEnc = path.join(
  root,
  "node_modules",
  "@jsquash",
  "webp",
  "codec",
  "enc",
);
const outDir = path.join(root, "public", "wasm");

function patchEmscriptenGlue(source) {
  let next = source;

  // Default-param form that SWC rewrites into `let Module`.
  next = next.replace(
    "function(Module = {})  {",
    "function(Module)  {\nModule = Module || {};",
  );
  next = next.replace(
    "function(Module = {}) {",
    "function(Module) {\nModule = Module || {};",
  );

  // Remove the redundant var redeclaration that conflicts after rewrite.
  next = next.replace(
    'var Module=typeof Module!="undefined"?Module:{};',
    "",
  );
  next = next.replace(
    "var Module = typeof Module != \"undefined\" ? Module : {};",
    "",
  );

  if (next.includes("function(Module = {})") || next.includes('var Module=typeof Module!="undefined"?Module:{};')) {
    throw new Error("Failed to patch Emscripten Module declarations.");
  }

  return next;
}

fs.mkdirSync(outDir, { recursive: true });

const glueName = "webp_enc.js";
const glueSource = fs.readFileSync(path.join(srcEnc, glueName), "utf8");
const patched = patchEmscriptenGlue(glueSource);
fs.writeFileSync(path.join(outDir, glueName), patched, "utf8");

// Ensure wasm binary is present (copy if missing/outdated).
const wasmName = "webp_enc.wasm";
fs.copyFileSync(path.join(srcEnc, wasmName), path.join(outDir, wasmName));

const entry = `/**
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
      locateFile: (file) => \`/wasm/\${file}\`,
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
`;

fs.writeFileSync(path.join(outDir, "encode-webp.js"), entry, "utf8");

console.log("Vendored patched WebP encoder to public/wasm/");
