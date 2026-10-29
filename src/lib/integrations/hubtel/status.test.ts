import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hubtelFetchTransactionStatus,
  mapHubtelLifecycleStatus,
} from "@/lib/integrations/hubtel/status";
import { PaymentStatus } from "@/types/enums";

describe("mapHubtelLifecycleStatus", () => {
  it("maps Paid to SUCCESS and Unpaid/Refunded safely", () => {
    expect(mapHubtelLifecycleStatus("Paid")).toEqual({
      lifecycleStatus: "Paid",
      paymentStatus: PaymentStatus.SUCCESS,
    });
    expect(mapHubtelLifecycleStatus("Unpaid").paymentStatus).toBe(
      PaymentStatus.PENDING,
    );
    expect(mapHubtelLifecycleStatus("Refunded").paymentStatus).toBe(
      PaymentStatus.FAILED,
    );
    expect(mapHubtelLifecycleStatus("weird").lifecycleStatus).toBe("Unknown");
  });
});

describe("hubtelFetchTransactionStatus", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses Paid status payloads with nullable-safe fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            responseCode: "0000",
            data: [
              {
                status: "Paid",
                clientReference: "GIS-20261027-AB12CD",
                transactionId: "txn_1",
                amount: "50.00",
                currency: "GHS",
                date: "2026-10-27T12:00:00.000Z",
              },
            ],
          }),
      }),
    );

    const result = await hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
      HUBTEL_PAYMENT_API_ID: "id",
      HUBTEL_PAYMENT_API_KEY: "key",
      HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
    });

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.amount).toBe(50);
    expect(result.currency).toBe("GHS");
    expect(result.providerReference).toBe("txn_1");
  });

  it("treats missing data as a permanent status parse failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ responseCode: "0000" }),
      }),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
        HUBTEL_PAYMENT_API_ID: "id",
        HUBTEL_PAYMENT_API_KEY: "key",
        HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
      }),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      retryable: false,
    });
  });

  it("marks network timeouts as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("AbortError")),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
        HUBTEL_PAYMENT_API_ID: "id",
        HUBTEL_PAYMENT_API_KEY: "key",
        HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
      }),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      retryable: true,
      message: expect.stringMatching(/Unable to reach Hubtel/i),
    });
  });

  it("parses Unpaid and Refunded without inventing Paid", async () => {
    const unpaidFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          responseCode: "0000",
          data: [{ status: "Unpaid", clientReference: "GIS-20261027-AB12CD" }],
        }),
    });
    vi.stubGlobal("fetch", unpaidFetch);

    const unpaid = await hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
      HUBTEL_PAYMENT_API_ID: "id",
      HUBTEL_PAYMENT_API_KEY: "key",
      HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
    });
    expect(unpaid.status).toBe(PaymentStatus.PENDING);
    expect(unpaid.lifecycleStatus).toBe("Unpaid");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            responseCode: "0000",
            data: [{ status: "Refunded", clientReference: "GIS-20261027-AB12CD" }],
          }),
      }),
    );

    const refunded = await hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
      HUBTEL_PAYMENT_API_ID: "id",
      HUBTEL_PAYMENT_API_KEY: "key",
      HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
    });
    expect(refunded.status).toBe(PaymentStatus.FAILED);
    expect(refunded.lifecycleStatus).toBe("Refunded");
  });

  it("marks upstream 5xx as retryable unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ message: "unavailable" }),
      }),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", {
        HUBTEL_PAYMENT_API_ID: "id",
        HUBTEL_PAYMENT_API_KEY: "key",
        HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
      }),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      retryable: true,
    });
  });
});
