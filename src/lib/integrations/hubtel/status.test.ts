import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hubtelFetchTransactionStatus,
  mapHubtelLifecycleStatus,
} from "@/lib/integrations/hubtel/status";
import { PaymentStatus } from "@/types/enums";

const testConfig = {
  HUBTEL_PAYMENT_API_ID: "id",
  HUBTEL_PAYMENT_API_KEY: "key",
  HUBTEL_COLLECTION_ACCOUNT_NUMBER: "2040955",
} as const;

function mockJsonResponse(input: {
  ok: boolean;
  status: number;
  body: unknown;
  contentType?: string | null;
}) {
  return {
    ok: input.ok,
    status: input.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type"
          ? (input.contentType ?? "application/json")
          : null,
    },
    text: async () =>
      typeof input.body === "string" ? input.body : JSON.stringify(input.body),
  };
}

function missingDataLogCalls(
  errorSpy: ReturnType<typeof vi.spyOn>,
): unknown[][] {
  return errorSpy.mock.calls.filter(
    (call) => call[0] === "[hubtel:status] missing data",
  );
}

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
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: {
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
          },
        }),
      ),
    );

    const result = await hubtelFetchTransactionStatus(
      "GIS-20261027-AB12CD",
      testConfig,
    );

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.amount).toBe(50);
    expect(result.currency).toBe("GHS");
    expect(result.providerReference).toBe("txn_1");
    expect(missingDataLogCalls(errorSpy)).toHaveLength(0);
  });

  it("parses production PascalCase Data/ResponseCode envelope without inventing Paid", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Nested record shape matches the existing lowercase fixtures (non-empty array
    // of transaction objects). Only the top-level envelope casing differs.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: {
            ResponseCode: "0000",
            Data: [
              {
                status: "Paid",
                clientReference: "GIS-20261029-LJYSRH",
                transactionId: "txn_pascal_1",
                amount: "50.00",
                currency: "GHS",
                date: "2026-10-29T05:00:00.000Z",
              },
            ],
          },
        }),
      ),
    );

    const result = await hubtelFetchTransactionStatus(
      "GIS-20261029-LJYSRH",
      testConfig,
    );

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.lifecycleStatus).toBe("Paid");
    expect(result.amount).toBe(50);
    expect(result.currency).toBe("GHS");
    expect(result.providerReference).toBe("txn_pascal_1");
    expect(result.clientReference).toBe("GIS-20261029-LJYSRH");
    expect(missingDataLogCalls(errorSpy)).toHaveLength(0);
  });

  it("parses PascalCase Data when it is a single object (same nested contract as lowercase)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: {
            ResponseCode: "0000",
            Data: {
              Status: "Unpaid",
              ClientReference: "GIS-20261027-AB12CD",
            },
          },
        }),
      ),
    );

    const result = await hubtelFetchTransactionStatus(
      "GIS-20261027-AB12CD",
      testConfig,
    );

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(result.lifecycleStatus).toBe("Unpaid");
  });

  it("still rejects ResponseCode alone without Data/data", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: { ResponseCode: "0000" },
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261029-LJYSRH", testConfig),
    ).rejects.toMatchObject({
      message: "Hubtel status response is missing data.",
      retryable: false,
    });

    expect(missingDataLogCalls(errorSpy)[0]?.[1]).toMatchObject({
      topLevelKeys: ["ResponseCode"],
      dataType: "undefined",
      hasResponseCode: true,
      responseCodeType: "string",
    });
  });

  it("treats missing data as a permanent status parse failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: { responseCode: "0000" },
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", testConfig),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      message: "Hubtel status response is missing data.",
      retryable: false,
    });

    const diagnosticCalls = missingDataLogCalls(errorSpy);
    expect(diagnosticCalls).toHaveLength(1);
    expect(diagnosticCalls[0]?.[1]).toMatchObject({
      httpStatus: 200,
      contentType: "application/json",
      payloadType: "object",
      topLevelKeys: ["responseCode"],
      dataType: "undefined",
      dataIsNull: false,
      dataArrayLength: null,
      hasResponseCode: true,
      responseCodeType: "string",
      hasMessage: false,
      messageType: null,
    });
    expect(JSON.stringify(diagnosticCalls[0])).not.toMatch(/Basic |api[_-]?key|secret|0000|responseBody/i);
  });

  it("logs safe diagnostics for empty data arrays without dumping the body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: {
            responseCode: "0000",
            message: "Customer paid GHS 50 — do not log this text",
            data: [],
          },
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261029-LJYSRH", testConfig),
    ).rejects.toMatchObject({
      message: "Hubtel status response is missing data.",
      retryable: false,
    });

    const diagnostic = missingDataLogCalls(errorSpy)[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(diagnostic).toMatchObject({
      dataType: "array",
      dataIsNull: false,
      dataArrayLength: 0,
      hasMessage: true,
      messageType: "string",
    });
    expect(JSON.stringify(missingDataLogCalls(errorSpy)[0])).not.toContain(
      "Customer paid",
    );
    expect(JSON.stringify(missingDataLogCalls(errorSpy)[0])).not.toContain(
      "GIS-20261029-LJYSRH",
    );
  });

  it("logs safe diagnostics when data is null", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: { responseCode: "0000", data: null },
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", testConfig),
    ).rejects.toMatchObject({
      message: "Hubtel status response is missing data.",
      retryable: false,
    });

    expect(missingDataLogCalls(errorSpy)[0]?.[1]).toMatchObject({
      dataType: "null",
      dataIsNull: true,
      dataArrayLength: null,
    });
  });

  it("logs payloadType for non-object JSON roots without body contents", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: [],
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", testConfig),
    ).rejects.toMatchObject({
      message: "Hubtel status response is missing data.",
      retryable: false,
    });

    expect(missingDataLogCalls(errorSpy)[0]?.[1]).toMatchObject({
      payloadType: "array",
      topLevelKeys: null,
      dataArrayLength: 0,
    });
  });

  it("marks network timeouts as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("AbortError")),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", testConfig),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      retryable: true,
      message: expect.stringMatching(/Unable to reach Hubtel/i),
    });
  });

  it("parses Unpaid and Refunded without inventing Paid", async () => {
    const unpaidFetch = vi.fn().mockResolvedValue(
      mockJsonResponse({
        ok: true,
        status: 200,
        body: {
          responseCode: "0000",
          data: [{ status: "Unpaid", clientReference: "GIS-20261027-AB12CD" }],
        },
      }),
    );
    vi.stubGlobal("fetch", unpaidFetch);

    const unpaid = await hubtelFetchTransactionStatus(
      "GIS-20261027-AB12CD",
      testConfig,
    );
    expect(unpaid.status).toBe(PaymentStatus.PENDING);
    expect(unpaid.lifecycleStatus).toBe("Unpaid");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: true,
          status: 200,
          body: {
            responseCode: "0000",
            data: [
              { status: "Refunded", clientReference: "GIS-20261027-AB12CD" },
            ],
          },
        }),
      ),
    );

    const refunded = await hubtelFetchTransactionStatus(
      "GIS-20261027-AB12CD",
      testConfig,
    );
    expect(refunded.status).toBe(PaymentStatus.FAILED);
    expect(refunded.lifecycleStatus).toBe("Refunded");
  });

  it("marks upstream 5xx as retryable unavailable without missing-data diagnostics", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          ok: false,
          status: 503,
          body: { message: "unavailable" },
        }),
      ),
    );

    await expect(
      hubtelFetchTransactionStatus("GIS-20261027-AB12CD", testConfig),
    ).rejects.toMatchObject({
      name: "HubtelStatusRequestError",
      retryable: true,
    });

    expect(missingDataLogCalls(errorSpy)).toHaveLength(0);
    expect(
      errorSpy.mock.calls.some((call) => call[0] === "[hubtel:status] http error"),
    ).toBe(true);
  });
});
