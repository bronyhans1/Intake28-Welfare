import { ACTIVATION_AUTH_EMAIL_DOMAIN } from "@/lib/constants/activation";
import { parseServiceNumberSuffix } from "@/lib/utils/service-number";

/**
 * Builds the Firebase Auth email for a GIS member.
 * Accepts full service number or suffix.
 * @example getAuthEmailFromServiceNumber("IS/13984") => "IS13984@giswelfare.local"
 */
export function getAuthEmailFromServiceNumber(serviceNumber: string): string {
  const suffix = parseServiceNumberSuffix(serviceNumber);
  return `IS${suffix}@${ACTIVATION_AUTH_EMAIL_DOMAIN}`;
}
