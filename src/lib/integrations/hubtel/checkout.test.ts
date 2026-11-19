import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHubtelPaymentBasicAuthHeader,
  buildHubtelTransactionStatusUrl,
  HUBTEL_CHECKOUT_INITIATE_URL,
  HUBTEL_CLIENT_REFERENCE_MAX_LENGTH,
  HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER,
  hubtelInitiateCheckout,
  HubtelCheckoutRequestError,
  HubtelPaymentConfigurationError,
} from "@/lib/integrations/hubtel/checkout";
import { generatePaymentReference } from "@/lib/payments/reference";

describe("Hubtel Online Checkout client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds Basic Auth without embedding plaintext secrets in the header scheme", () => {
    const header = buildHubtelPaymentBasicAuthHeader("api-id-value", "api-key-value");
    expect(header.startsWith("Basic ")).toBe(true);
    expect(header).not.toContain("api-id-value");
    expect(header).not.toContain("api-key-value");
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
      "utf8",
    );
    expect(decoded).toBe("api-id-value:api-key-value");
  });

  it("keeps GIS payment references within Hubtel clientReference length", () => {
    const reference = generatePaymentReference(new Date("2026-10-27T12:00:00.000Z"));
    expect(reference.length).toBeLessThanOrEqual(HUBTEL_CLIENT_REFERENCE_MAX_LENGTH);
    expect(reference.startsWith("GIS-20261027-")).toBe(true);
  });

  it("builds the confirmed transaction status URL", () => {
    const url = buildHubtelTransactionStatusUrl("GIS-20261027-AB12CD");
    expect(url).toContain(
      `/merchants/${HUBTEL_DEFAULT_COLLECTION_ACCOUNT_NUMBER}/transactions/status`,
    );
    expect(url).toContain("clientReference=GIS-20261027-AB12CD");
  });

  it("rejects missing payment credentials", async () => {
    vi.stubEnv("HUBTEL_PAYMENT_API_ID", undefined);
    vi.stubEnv("HUBTEL_PAYMENT_API_KEY", undefined);
    delete process.env.HUBTEL_PAYMENT_API_ID;
    delete process.env.HUBTEL_PAYMENT_API_KEY;

    await expect(
      hubtelInitiateCheckout({
        totalAmount: 50,
        description: "Monthly dues",
        callbackUrl: "https://app.example/api/payments/callback",
        returnUrl: "https://app.example/payments",
        cancellationUrl: "https://app.example/portal/contributions",
        clientReference: "GIS-20261027-AB12CD",
      }),
    ).rejects.toBeInstanceOf(HubtelPaymentConfigurationError);
  });

  it("sends the required checkout payload with collection account and Basic Auth", async () => {
    vi.stubEnv("HUBTEL_PAYMENT_API_ID", "payment-api-id");
    vi.stubEnv("HUBTEL_PAYMENT_API_KEY", "payment-api-key");
    vi.stubEnv("HUBTEL_COLLECTION_ACCOUNT_NUMBER", "2040955");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          responseCode: "0000",
          status: "Success",
          data: {
            checkoutUrl: "https://pay.hubtel.com/checkout/abc",
            checkoutId: "chk_1",
            clientReference: "GIS-20261027-AB12CD",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await hubtelInitiateCheckout({
      totalAmount: 50,
      description: "Monthly dues (October 2026)",
      callbackUrl: "https://app.example/api/payments/callback?reference=GIS-20261027-AB12CD",
      returnUrl: "https://app.example/payments?reference=GIS-20261027-AB12CD",
      cancellationUrl: "https://app.example/portal/contributions?cancelled=1",
      clientReference: "GIS-20261027-AB12CD",
    });

    expect(result.checkoutUrl).toBe("https://pay.hubtel.com/checkout/abc");
    expect(result.checkoutId).toBe("chk_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(HUBTEL_CHECKOUT_INITIATE_URL);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      buildHubtelPaymentBasicAuthHeader("payment-api-id", "payment-api-key"),
    );
    expect(JSON.stringify(headers)).not.toContain("payment-api-key");

    expect(JSON.parse(String(init.body))).toEqual({
      totalAmount: 50,
      description: "Monthly dues (October 2026)",
      callbackUrl:
        "https://app.example/api/payments/callback?reference=GIS-20261027-AB12CD",
      returnUrl: "https://app.example/payments?reference=GIS-20261027-AB12CD",
      merchantAccountNumber: "2040955",
      cancellationUrl: "https://app.example/portal/contributions?cancelled=1",
      clientReference: "GIS-20261027-AB12CD",
    });
  });

  it("rejects oversized client references", async () => {
    await expect(
      hubtelInitiateCheckout(
        {
          totalAmount: 50,
          description: "Monthly dues",
          callbackUrl: "https://app.example/callback",
          returnUrl: "https://app.example/return",
          cancellationUrl: "https://app.example/cancel",
          clientReference: "X".repeat(HUBTEL_CLIENT_REFERENCE_MAX_LENGTH + 1),
        },
        {
          HUBTEL_PAYMENT_API_ID: "id",
          HUBTEL_PAYMENT_API_KEY: "key",
          HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
        },
      ),
    ).rejects.toBeInstanceOf(HubtelCheckoutRequestError);
  });

  it("maps Hubtel rejection without treating it as success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          responseCode: "4000",
          status: "Failed",
          message: "Invalid merchant account",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      hubtelInitiateCheckout(
        {
          totalAmount: 50,
          description: "Monthly dues",
          callbackUrl: "https://app.example/callback",
          returnUrl: "https://app.example/return",
          cancellationUrl: "https://app.example/cancel",
          clientReference: "GIS-20261027-AB12CD",
        },
        {
          HUBTEL_PAYMENT_API_ID: "id",
          HUBTEL_PAYMENT_API_KEY: "key",
          HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
        },
      ),
    ).rejects.toThrow("Invalid merchant account");
  });

  it("handles network timeouts safely", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("AbortError: timeout"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      hubtelInitiateCheckout(
        {
          totalAmount: 50,
          description: "Monthly dues",
          callbackUrl: "https://app.example/callback",
          returnUrl: "https://app.example/return",
          cancellationUrl: "https://app.example/cancel",
          clientReference: "GIS-20261027-AB12CD",
        },
        {
          HUBTEL_PAYMENT_API_ID: "id",
          HUBTEL_PAYMENT_API_KEY: "key",
          HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
        },
      ),
    ).rejects.toThrow(/Unable to reach Hubtel checkout/);
  });

  it("rejects malformed Hubtel JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "not-json",
      }),
    );

    await expect(
      hubtelInitiateCheckout(
        {
          totalAmount: 50,
          description: "Monthly dues",
          callbackUrl: "https://app.example/callback",
          returnUrl: "https://app.example/return",
          cancellationUrl: "https://app.example/cancel",
          clientReference: "GIS-20261027-AB12CD",
        },
        {
          HUBTEL_PAYMENT_API_ID: "id",
          HUBTEL_PAYMENT_API_KEY: "key",
          HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
        },
      ),
    ).rejects.toThrow(/invalid checkout response/i);
  });
});
