import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSettlePaymentIngest = vi.fn();
const mockRecordCallbackOutcomeAudit = vi.fn();
const mockIsFirebaseAdminConfigured = vi.fn();

vi.mock("@/lib/payments/paystack-ingest", () => ({
  settlePaymentIngest: (...args: unknown[]) => mockSettlePaymentIngest(...args),
  recordCallbackOutcomeAudit: (...args: unknown[]) =>
    mockRecordCallbackOutcomeAudit(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  isFirebaseAdminConfigured: () => mockIsFirebaseAdminConfigured(),
}));

vi.mock("@/config/env", () => ({
  env: {
    client: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
    server: () => ({}),
  },
}));

describe("payments callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFirebaseAdminConfigured.mockReturnValue(true);
    mockRecordCallbackOutcomeAudit.mockResolvedValue(undefined);
  });

  it("GET treats query params as untrusted and settles only via ingest", async () => {
    mockSettlePaymentIngest.mockResolvedValue({
      ack: "processed",
      category: "settled",
      message: "ok",
      httpStatus: 200,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/payments/callback?clientReference=GIS-20261027-AB12CD&status=Paid",
      ),
    );

    expect(mockSettlePaymentIngest).toHaveBeenCalledWith(
      "GIS-20261027-AB12CD",
      "callback",
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/payments?verified=1");
  });

  it("GET redirects to pending when Hubtel status is still Unpaid", async () => {
    mockSettlePaymentIngest.mockResolvedValue({
      ack: "processed",
      category: "non_success_status",
      message: "Hubtel reported status: Unpaid",
      settlementOutcome: "pending",
      httpStatus: 200,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost:3000/api/payments/callback?reference=GIS-20261027-AB12CD",
      ),
    );

    expect(response.headers.get("location")).toContain("/payments?pending=1");
  });

  it("POST ignores body success claims and settles by extracted reference", async () => {
    mockSettlePaymentIngest.mockResolvedValue({
      ack: "processed",
      category: "settled",
      message: "ok",
      httpStatus: 200,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost:3000/api/payments/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "Paid",
          data: { clientReference: "GIS-20261027-AB12CD" },
        }),
      }),
    );

    expect(mockSettlePaymentIngest).toHaveBeenCalledWith(
      "GIS-20261027-AB12CD",
      "callback",
    );
    const json = await response.json();
    expect(json).toMatchObject({
      received: true,
      outcome: "processed",
      category: "settled",
    });
  });

  it("rejects missing references without settling", async () => {
    const { GET, POST } = await import("./route");

    const getResponse = await GET(
      new Request("http://localhost:3000/api/payments/callback"),
    );
    expect(mockSettlePaymentIngest).not.toHaveBeenCalled();
    expect(getResponse.headers.get("location")).toContain(
      "error=missing_reference",
    );

    const postResponse = await POST(
      new Request("http://localhost:3000/api/payments/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Paid" }),
      }),
    );
    expect(mockSettlePaymentIngest).not.toHaveBeenCalled();
    expect(postResponse.status).toBe(400);
  });

  it("does not settle arbitrary unknown references as success", async () => {
    mockSettlePaymentIngest.mockResolvedValue({
      ack: "rejected_permanent",
      category: "payment_not_found",
      message: "Payment not found.",
      httpStatus: 200,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost:3000/api/payments/callback", {
        method: "POST",
        body: JSON.stringify({ clientReference: "GIS-FAKE-XXXXXX" }),
      }),
    );

    expect(mockSettlePaymentIngest).toHaveBeenCalledWith(
      "GIS-FAKE-XXXXXX",
      "callback",
    );
    const json = await response.json();
    expect(json.category).toBe("payment_not_found");
    expect(json.outcome).toBe("rejected_permanent");
  });
});
