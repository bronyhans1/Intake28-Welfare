import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { PaymentSettlementError } from "@/lib/payments/paystack-settlement-rules";
import {
  classifySettlementFailure,
  classifySettlementResult,
  settlePaystackIngest,
} from "@/lib/payments/paystack-ingest";
import { PaymentStatus, PaymentType } from "@/types/enums";

const mockSettle = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/payments/settlement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/settlement")>(
    "@/lib/payments/settlement",
  );
  return {
    ...actual,
    settlePaymentFromPaystackReference: (...args: unknown[]) => mockSettle(...args),
  };
});

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

describe("classifySettlementFailure", () => {
  it("treats validation SettlementErrors as permanent 200 acknowledgements", () => {
    expect(
      classifySettlementFailure(new PaymentSettlementError("Payment not found.")),
    ).toMatchObject({
      ack: "rejected_permanent",
      category: "payment_not_found",
      httpStatus: 200,
    });
    expect(
      classifySettlementFailure(
        new PaymentSettlementError(
          "Paystack amount does not match the expected payment amount.",
        ),
      ),
    ).toMatchObject({
      ack: "rejected_permanent",
      category: "amount_mismatch",
      httpStatus: 200,
    });
    expect(
      classifySettlementFailure(
        new PaymentSettlementError(
          "Paystack currency does not match the expected payment currency.",
        ),
      ),
    ).toMatchObject({
      ack: "rejected_permanent",
      category: "currency_mismatch",
      httpStatus: 200,
    });
  });

  it("treats retryable SettlementErrors as 503", () => {
    expect(
      classifySettlementFailure(
        new PaymentSettlementError("Failed to verify Paystack payment.", {
          retryable: true,
        }),
      ),
    ).toMatchObject({
      ack: "retryable",
      category: "paystack_verify_unavailable",
      httpStatus: 503,
    });
  });

  it("treats post-success recording errors as retryable 500", () => {
    expect(
      classifySettlementFailure(new Error("contribution write failed")),
    ).toMatchObject({
      ack: "retryable",
      category: "post_success_recording_error",
      httpStatus: 500,
    });
  });
});

describe("classifySettlementResult", () => {
  it("maps settled and already_settled to processed 200", () => {
    expect(classifySettlementResult("settled")).toMatchObject({
      ack: "processed",
      category: "settled",
      httpStatus: 200,
    });
    expect(classifySettlementResult("already_settled")).toMatchObject({
      ack: "processed",
      category: "already_settled",
      httpStatus: 200,
    });
  });

  it("maps non-success verify outcomes to processed 200", () => {
    expect(classifySettlementResult("failed")).toMatchObject({
      ack: "processed",
      category: "non_success_status",
      httpStatus: 200,
    });
  });
});

describe("settlePaystackIngest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns processed classification for successful settlement", async () => {
    mockSettle.mockResolvedValue({
      outcome: "settled",
      payment: {
        id: "p1",
        reference: "GIS-1",
        status: PaymentStatus.SUCCESS,
        paymentType: PaymentType.MONTHLY_DUES,
      },
      message: "Payment settled successfully.",
    });

    const result = await settlePaystackIngest("GIS-1", "webhook");
    expect(result).toMatchObject({
      ack: "processed",
      category: "settled",
      httpStatus: 200,
    });
    expect(mockSettle).toHaveBeenCalledWith("GIS-1", { source: "webhook" });
  });

  it("classifies permanent settlement rejection without throwing", async () => {
    mockSettle.mockRejectedValue(new PaymentSettlementError("Payment not found."));
    const result = await settlePaystackIngest("GIS-MISSING", "webhook");
    expect(result.ack).toBe("rejected_permanent");
    expect(result.httpStatus).toBe(200);
  });
});

describe("ingest audit actions", () => {
  it("registers webhook and callback audit action constants", () => {
    expect(PaymentAuditAction.PAYMENT_WEBHOOK_OUTCOME).toBe("payment_webhook_outcome");
    expect(PaymentAuditAction.PAYMENT_CALLBACK_OUTCOME).toBe("payment_callback_outcome");
  });
});
