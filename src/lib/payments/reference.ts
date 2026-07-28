const REFERENCE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function formatPaymentReferenceDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function generatePaymentReferenceSuffix(length = 6, random = Math.random): string {
  let suffix = "";
  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(random() * REFERENCE_CHARS.length);
    suffix += REFERENCE_CHARS[charIndex];
  }
  return suffix;
}

export function generatePaymentReference(now = new Date(), random = Math.random): string {
  return `GIS-${formatPaymentReferenceDate(now)}-${generatePaymentReferenceSuffix(6, random)}`;
}

export function isPaymentReference(value: string): boolean {
  return /^GIS-\d{8}-[A-Z0-9]{6}$/.test(value);
}
