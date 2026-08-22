import { getHubtelConfig } from "@/lib/integrations/hubtel/config";
import { formatPhoneForHubtelSms } from "@/lib/utils/phone";

const HUBTEL_SMS_URL = "https://smsc.hubtel.com/v1/messages/send";
const HUBTEL_SMS_TIMEOUT_MS = 15_000;
const HUBTEL_ERROR_BODY_LOG_LIMIT = 500;

export interface HubtelSmsResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

function maskPhoneInText(value: string): string {
  return value
    .replace(/\+233\d{9}/g, "+233*******")
    .replace(/\b0\d{9}\b/g, "0*******");
}

/** Redacts OTP-like codes and phone numbers from Hubtel error payloads. */
function sanitizeHubtelErrorBody(text: string): string {
  const redacted = maskPhoneInText(text)
    .replace(/\b\d{6}\b/g, "******")
    .replace(
      /"(client[_-]?secret|client[_-]?id|password|authorization)"\s*:\s*"[^"]*"/gi,
      '"$1":"***"',
    )
    .replace(/clientsecret=[^&\s]+/gi, "clientsecret=***")
    .replace(/clientid=[^&\s]+/gi, "clientid=***");

  if (redacted.length <= HUBTEL_ERROR_BODY_LOG_LIMIT) {
    return redacted;
  }

  return `${redacted.slice(0, HUBTEL_ERROR_BODY_LOG_LIMIT)}…`;
}

function parseMessageId(payload: Record<string, unknown>): string | undefined {
  const messageId = payload.messageId ?? payload.MessageId;
  return typeof messageId === "string" ? messageId : undefined;
}

/**
 * Sends an SMS via Hubtel when credentials are configured.
 * Invoked only from the OTP SMS abstraction layer.
 *
 * Transport matches the original project request (Basic Auth + JSON body),
 * with the migrated host smsc.hubtel.com only.
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
        responseBody: sanitizeHubtelErrorBody(responseText),
      });
      return { sent: false, error: `http_${response.status}` };
    }

    if (!responseText.trim()) {
      return { sent: true };
    }

    try {
      const payload = JSON.parse(responseText) as Record<string, unknown>;
      return { sent: true, messageId: parseMessageId(payload) };
    } catch {
      console.error("[hubtel:sms] Malformed JSON response", {
        recipientSuffix: recipient.slice(-4),
        responseBody: sanitizeHubtelErrorBody(responseText),
      });
      return { sent: false, error: "malformed_response" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown";
    console.error("[hubtel:sms] Request failed", {
      error: sanitizeHubtelErrorBody(errorMessage),
    });
    return { sent: false, error: "network_failure" };
  }
}
