/**
 * Converts a human-readable name into a stable internal id slug.
 * Example: "Medical Assistance" → "medical_assistance"
 */
export function slugifyToInternalId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!slug) return "";
  if (/^[a-z]/.test(slug)) return slug;
  return `id_${slug}`;
}

/**
 * Allocates the next constitution_vN id from existing version ids.
 */
export function nextConstitutionVersionId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = /^constitution_v(\d+)$/i.exec(id.trim());
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `constitution_v${max + 1}`;
}

export function rulesetVersionFromConstitutionId(constitutionId: string): string {
  const trimmed = constitutionId.trim();
  if (trimmed.startsWith("constitution_")) {
    return trimmed.replace(/^constitution_/, "rules_");
  }
  return `rules_${slugifyToInternalId(trimmed) || "v1"}`;
}
