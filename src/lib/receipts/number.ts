import {
  formatPaymentReferenceDate,
  generatePaymentReferenceSuffix,
} from "@/lib/payments/reference";

export function generateReceiptNumber(now = new Date(), random = Math.random): string {
  return `GIS-RCP-${formatPaymentReferenceDate(now)}-${generatePaymentReferenceSuffix(6, random)}`;
}

export function isReceiptNumber(value: string): boolean {
  return /^GIS-RCP-\d{8}-[A-Z0-9]{6}$/.test(value);
}
