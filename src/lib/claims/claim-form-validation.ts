/**
 * Claim form field-order and error helpers (member New Claim / Edit Draft UI).
 * Server schemas in `@/lib/validators/claims` remain authoritative.
 */

export const CLAIM_FORM_FIELD_ORDER = [
  "claimTypeCode",
  "incidentDate",
  "title",
  "description",
  "attachment",
  "whatsappEvidenceNote",
  "attachmentUrl",
  "attachmentPath",
  "attachmentFileName",
  "attachmentContentType",
] as const;

export type ClaimFormFieldKey = (typeof CLAIM_FORM_FIELD_ORDER)[number];

/** DOM id for focus/scroll — maps server field names onto form control ids. */
export function claimFormFieldElementId(field: string): string {
  if (field === "attachmentUrl" || field === "attachmentPath") {
    return "attachment";
  }
  return field;
}

export function mapClaimFormFieldErrors(
  fieldErrors: Record<string, string[] | undefined> | undefined,
): Record<string, string> {
  if (!fieldErrors) return {};
  const next: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) {
      next[key] = messages[0];
    }
  }
  return next;
}

export function getFirstInvalidClaimFormField(
  fieldErrors: Record<string, string | undefined>,
): string | null {
  for (const field of CLAIM_FORM_FIELD_ORDER) {
    if (fieldErrors[field]) {
      return claimFormFieldElementId(field);
    }
  }

  const fallback = Object.keys(fieldErrors).find((key) => fieldErrors[key]);
  return fallback ? claimFormFieldElementId(fallback) : null;
}

export function focusClaimFormField(fieldId: string): void {
  if (typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    const element = document.getElementById(fieldId);
    element?.focus();
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
