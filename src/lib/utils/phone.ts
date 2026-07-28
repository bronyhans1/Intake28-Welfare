/**
 * Normalizes a Ghana phone number for storage and comparison.
 * Converts +233 / 233 prefixes to leading 0 format.
 * @example normalizePhoneNumber("024 123 4567") => "0241234567"
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("233") && digits.length === 12) {
    return `0${digits.slice(3)}`;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return digits;
  }

  return phone.trim().replace(/\s/g, "");
}

export function phoneNumbersMatch(a: string, b: string): boolean {
  return normalizePhoneNumber(a) === normalizePhoneNumber(b);
}
