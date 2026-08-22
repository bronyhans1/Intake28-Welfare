import { getHubtelConfig } from "@/lib/integrations/hubtel/config";
import { formatPhoneForHubtelSms } from "@/lib/utils/phone";

const HUBTEL_SMS_URL = "https://sms.hubtel.com/v1/messages/send";
const HUBTEL_SMS_TIMEOUT_MS = 15_000;

export interface HubtelSmsResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends an SMS via Hubtel when credentials are configured.
 * Invoked only from the OTP SMS abstraction layer.
 */
export async function sendHubtelSms(
  to: string,
  message: string,
): Promise<HubtelSmsResult> {
  try {
    const config = getHubtelConfig();
    const credentials = Buffer.from(
      `${config.HUBTEL_CLIENT_ID}:${config.HUBTEL_CLIENT_SECRET}`,
    ).toString("base64");
    const recipient = formatPhoneForHubtelSms(to);

    const response = await fetch(HUBTEL_SMS_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: config.HUBTEL_SENDER_ID,
        To: recipient,
        Content: message,
      }),
      signal: AbortSignal.timeout(HUBTEL_SMS_TIMEOUT_MS),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[hubtel:sms] HTTP error", {
        status: response.status,
        recipientSuffix: recipient.slice(-4),
      });
      return { sent: false, error: `http_${response.status}` };
    }

    let payload: { MessageId?: string } = {};
    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText) as { MessageId?: string };
      } catch {
        console.error("[hubtel:sms] Malformed JSON response", {
          recipientSuffix: recipient.slice(-4),
        });
        return { sent: false, error: "malformed_response" };
      }
    }

    return { sent: true, messageId: payload.MessageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[hubtel:sms] Request failed", { error: message });
    return { sent: false, error: "network_failure" };
  }
}
