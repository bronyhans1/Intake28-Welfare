import { getHubtelConfig } from "@/lib/integrations/hubtel/config";

export interface HubtelSmsResult {
  sent: boolean;
  messageId?: string;
}

/**
 * Sends an SMS via Hubtel when credentials are configured.
 * Invoked only from the OTP SMS abstraction layer.
 */
export async function sendHubtelSms(
  to: string,
  message: string,
): Promise<HubtelSmsResult> {
  const config = getHubtelConfig();
  const credentials = Buffer.from(
    `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch("https://sms.hubtel.com/v1/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: config.HUBTEL_SENDER_ID,
      To: to,
      Content: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Hubtel SMS failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { MessageId?: string };
  return { sent: true, messageId: payload.MessageId };
}
