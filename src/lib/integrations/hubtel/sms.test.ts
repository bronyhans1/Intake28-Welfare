import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHubtelSms } from "@/lib/integrations/hubtel/sms";

const mockFetch = vi.fn();
const OTP_MESSAGE =
  "Your GIS Welfare verification code is 654321. Valid for 10 minutes.";

describe("sendHubtelSms", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
    process.env.HUBTEL_CLIENT_ID = "client-id";
    process.env.HUBTEL_CLIENT_SECRET = "client-secret";
    process.env.HUBTEL_SENDER_ID = "GISINT28";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to smsc.hubtel.com with Basic Auth and lowercase JSON body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ messageId: "msg-123" }),
    });

    const result = await sendHubtelSms("0241234567", OTP_MESSAGE);

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("msg-123");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://smsc.hubtel.com/v1/messages/send");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers.Authorization).not.toContain("client-secret");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      from: "GISINT28",
      to: "+233241234567",
      content: OTP_MESSAGE,
    });
    expect(body.content).toMatch(/\d{6}/);
    expect(body.content).not.toMatch(/client-secret|client-id/);
  });

  it("accepts legacy PascalCase messageId in success responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ MessageId: "msg-legacy" }),
    });

    const result = await sendHubtelSms("0241234567", "Hello");
    expect(result.messageId).toBe("msg-legacy");
  });

  it("returns failure on HTTP error without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ message: "Invalid sender +233241234567" }),
    });

    const result = await sendHubtelSms("0241234567", OTP_MESSAGE);
    expect(result.sent).toBe(false);
    expect(result.error).toBe("http_400");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[hubtel:sms] HTTP error",
      expect.objectContaining({
        status: 400,
        responseBody: expect.stringContaining("Invalid sender"),
      }),
    );

    consoleSpy.mockRestore();
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
