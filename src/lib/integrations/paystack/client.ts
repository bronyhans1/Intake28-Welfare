import { env } from "@/config/env";
import { PaymentStatus } from "@/types/enums";

export class PaystackConfigurationError extends Error {
  constructor(message = "Paystack is not configured.") {
    super(message);
    this.name = "PaystackConfigurationError";
  }
}

export class PaystackRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackRequestError";
  }
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
  };
}

function getPaystackSecretKey(): string {
  const secretKey = env.server().PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new PaystackConfigurationError();
  }
  return secretKey;
}

function mapPaystackStatus(status: string): PaymentStatus {
  switch (status) {
    case "success":
      return PaymentStatus.SUCCESS;
    case "failed":
      return PaymentStatus.FAILED;
    case "abandoned":
      return PaymentStatus.ABANDONED;
    default:
      return PaymentStatus.PENDING;
  }
}

export async function paystackInitializeTransaction(input: {
  email: string;
  amount: number;
  reference: string;
  currency: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string }> {
  const requestBody = {
    email: input.email,
    amount: Math.round(input.amount * 100),
    reference: input.reference,
    currency: input.currency,
    callback_url: input.callbackUrl,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  console.info("[paystack] initialize transaction payload", requestBody);

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = (await response.json()) as PaystackInitializeResponse;

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new PaystackRequestError(payload.message || "Failed to initialize Paystack payment.");
  }

  return { authorizationUrl: payload.data.authorization_url };
}

export async function paystackVerifyTransaction(reference: string): Promise<{
  status: PaymentStatus;
  providerReference: string;
  paidAt: Date | null;
}> {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
      },
    },
  );

  const payload = (await response.json()) as PaystackVerifyResponse;

  if (!response.ok || !payload.status || !payload.data) {
    throw new PaystackRequestError(payload.message || "Failed to verify Paystack payment.");
  }

  return {
    status: mapPaystackStatus(payload.data.status),
    providerReference: payload.data.reference,
    paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : null,
  };
}

export { mapPaystackStatus };
