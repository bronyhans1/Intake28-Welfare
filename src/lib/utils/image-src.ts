/** Returns a trimmed image URL or null when the value is not safe to pass to Image/img. */
export function getValidImageSrc(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
}
