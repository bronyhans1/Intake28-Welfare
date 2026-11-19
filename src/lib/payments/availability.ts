/**
 * Server-enforced online payment initiation control (Hubtel Checkout).
 *
 * Fail-closed: payments are enabled only when PAYMENTS_ENABLED is exactly "true".
 * Missing, empty, or any other value disables new online initializations.
 *
 * Does not affect webhook/callback/verify settlement or admin recovery.
 * Member UI also requires Hubtel credentials — see areMemberOnlinePaymentsAvailable.
 */

export const PAYMENTS_UNAVAILABLE_MESSAGE =
  "Online payment is currently unavailable. Your contribution records and receipts remain accessible. Please check back later for updates." as const;

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
