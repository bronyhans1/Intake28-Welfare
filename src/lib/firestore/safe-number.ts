/**
 * Coerces a value to a finite number for Firestore counters and metrics.
 * Returns `fallback` for undefined, null, NaN, and Infinity.
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}
