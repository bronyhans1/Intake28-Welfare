import { SERVICE_NUMBER_PREFIX } from "@/lib/constants";

const SUFFIX_PATTERN = /^\d+$/;

/**
 * Formats a numeric suffix into a full GIS service number.
 * @example formatServiceNumber("13984") => "IS/13984"
 */
export function formatServiceNumber(suffix: string): string {
  const normalized = normalizeServiceNumberSuffix(suffix);
  return `${SERVICE_NUMBER_PREFIX}${normalized}`;
}

/**
 * Strips prefix and whitespace from input, returning the numeric suffix only.
 */
export function parseServiceNumberSuffix(input: string): string {
  const trimmed = input.trim().toUpperCase();

  if (trimmed.startsWith(SERVICE_NUMBER_PREFIX)) {
    return trimmed.slice(SERVICE_NUMBER_PREFIX.length);
  }

  return trimmed;
}

/**
 * Normalizes suffix: digits only, no leading zeros stripped unless empty.
 */
export function normalizeServiceNumberSuffix(suffix: string): string {
  return parseServiceNumberSuffix(suffix).replace(/\s/g, "");
}

export function isValidServiceNumberSuffix(suffix: string): boolean {
  const normalized = normalizeServiceNumberSuffix(suffix);
  return normalized.length > 0 && SUFFIX_PATTERN.test(normalized);
}

export function serviceNumbersMatch(a: string, b: string): boolean {
  return formatServiceNumber(a) === formatServiceNumber(b);
}
