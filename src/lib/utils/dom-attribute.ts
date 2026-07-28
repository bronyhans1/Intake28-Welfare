type BooleanishAttribute =
  | boolean
  | "true"
  | "false"
  | "grammar"
  | "spelling"
  | undefined;

/** Only emit boolean data/ARIA attributes when true — avoids SSR `="false"` hydration mismatches. */
export function toTruthyDataAttribute(
  value: BooleanishAttribute,
): true | "grammar" | "spelling" | undefined {
  if (value === "grammar" || value === "spelling") {
    return value;
  }

  if (value === true || value === "true") {
    return true;
  }

  return undefined;
}
