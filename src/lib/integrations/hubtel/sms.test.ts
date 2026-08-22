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

  it("posts to smsc.hubtel.com with query-parameter credentials", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ messageId: "msg-123" }),
    });

    const result = await sendHubtelSms("0241234567", OTP_MESSAGE);

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe("msg-123");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://smsc.hubtel.com/v1/messages/send",
    );
    expect(parsed.searchParams.get("clientid")).toBe("client-id");
    expect(parsed.searchParams.get("clientsecret")).toBe("client-secret");
    expect(parsed.searchParams.get("from")).toBe("GISINT28");
    expect(parsed.searchParams.get("to")).toBe("+233241234567");
    expect(parsed.searchParams.get("content")).toBe(OTP_MESSAGE);
    expect(parsed.searchParams.get("content")).toMatch(/\d{6}/);
  });

  it("accepts legacy PascalCase messageId in success responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ MessageId: "msg-legacy" }),
    });

    const result = await sendHubtelSms("0241234567", "Hello");
    expect(result.messageId).toBe("msg-legacy");
  });

  it("returns failure on HTTP error without logging credentials", async () => {
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

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).not.toContain("client-secret");
    expect(logged).not.toContain("client-id");
    expect(logged).not.toContain("654321");
    expect(logged).not.toContain("+233241234567");
    expect(logged).not.toContain("smsc.hubtel.com/v1/messages/send?");

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
