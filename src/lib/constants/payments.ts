/** Fallback domain when PAYMENT_EMAIL_DOMAIN is unset and app URL is localhost. */
export const PAYMENT_EMAIL_DOMAIN_FALLBACK = "gis28welfare.org" as const;

/** TLDs Paystack rejects even when they pass basic RFC checks. */
export const PAYSTACK_BLOCKED_EMAIL_TLDS = [
  ".local",
  ".localhost",
  ".invalid",
  ".test",
] as const;
