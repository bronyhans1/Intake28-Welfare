/**
 * Server-enforced Paystack payment initiation control.
 *
 * Fail-closed: payments are enabled only when PAYMENTS_ENABLED is exactly "true".
 * Missing, empty, or any other value disables new Paystack initializations.
 *
 * Does not affect webhook/callback/verify settlement or admin recovery.
 */

export const PAYMENTS_UNAVAILABLE_MESSAGE =
  "Online payments are temporarily unavailable while we complete a payment service compliance review. Your contribution records and receipts remain accessible. Please check back later for updates." as const;

export class PaymentsUnavailableError extends Error {
  constructor(message: string = PAYMENTS_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "PaymentsUnavailableError";
  }
}

/**
 * Returns true only when the server env explicitly enables payments.
 */
export function isPaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === "true";
}

export function assertPaymentsEnabled(): void {
  if (!isPaymentsEnabled()) {
    throw new PaymentsUnavailableError();
  }
}
