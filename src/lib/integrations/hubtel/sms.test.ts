import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHubtelSms } from "@/lib/integrations/hubtel/sms";

const mockFetch = vi.fn();

describe("sendHubtelSms", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GIS";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends SMS with international phone format on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ MessageId: "msg-123" }),
    });

    const result = await sendHubtelSms("0241234567", "Hello");

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("msg-123");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      From: "GIS",
      To: "+233241234567",
      Content: "Hello",
    });
    expect(body.Content).not.toMatch(/client-secret|client-id/);
  });

  it("returns failure on HTTP error without throwing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    });

    const result = await sendHubtelSms("0241234567", "Hello");
    expect(result.sent).toBe(false);
    expect(result.error).toBe("http_500");
  });

  it("returns failure on malformed JSON response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "not-json",
    });

    const result = await sendHubtelSms("0241234567", "Hello");
    expect(result.sent).toBe(false);
    expect(result.error).toBe("malformed_response");
  });

  it("returns failure on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    const result = await sendHubtelSms("0241234567", "Hello");
    expect(result.sent).toBe(false);
    expect(result.error).toBe("network_failure");
  });
});
