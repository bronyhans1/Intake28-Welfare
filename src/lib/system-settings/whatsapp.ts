/**
 * WhatsApp Community settings helpers — validation and member-portal visibility.
 */

const WHATSAPP_HOST_SUFFIXES = [
  "chat.whatsapp.com",
  "wa.me",
  "whatsapp.com",
] as const;

/**
 * Returns true for a non-empty HTTPS WhatsApp invite/community URL.
 * Blank values are not "valid for display" (use separate empty checks when saving).
 */
export function isValidWhatsAppCommunityUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return WHATSAPP_HOST_SUFFIXES.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export function normalizeWhatsAppCommunityUrl(url: string): string {
  return url.trim();
}

/**
 * Member FAB visibility: enabled toggle AND a valid configured HTTPS WhatsApp URL.
 */
export function shouldShowWhatsAppCommunityButton(settings: {
  whatsappCommunityEnabled?: boolean | null;
  whatsappCommunityUrl?: string | null;
}): boolean {
  if (settings.whatsappCommunityEnabled !== true) return false;
  return isValidWhatsAppCommunityUrl(settings.whatsappCommunityUrl ?? "");
}
