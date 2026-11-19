import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentStatus, PaymentType } from "@/types/enums";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockRunTransaction = vi.fn();
const mockOrderByGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  }),
}));

import { claimPaymentSuccessTransition } from "@/lib/payments/repository";

const reference = "GIS-20261027-CLAIM1";

function paymentData(status: string, provider = "hubtel") {
  return {
    memberId: "member-1",
    memberName: "Member",
    serviceNumber: "IS/00002",
    email: "a@b.c",
    amount: 50,
    currency: "GHS",
    reference,
    paymentType: PaymentType.MONTHLY_DUES,
    paymentCategory: "contribution",
    provider,
    providerReference: status === PaymentStatus.SUCCESS ? "txn" : null,
    status,
    paidAt: null,
    createdAt: { seconds: 1, nanoseconds: 0 },
    updatedAt: { seconds: 1, nanoseconds: 0 },
  };
}

function stubListByStatus(status: string, provider = "hubtel") {
  mockOrderByGet.mockResolvedValue({
    docs: [
      {
        id: "payment-doc-1",
        data: () => paymentData(status, provider),
      },
    ],
  });
}

describe("claimPaymentSuccessTransition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({
      doc: mockDoc,
      orderBy: () => ({ get: mockOrderByGet }),
    });
    mockDoc.mockImplementation((id?: string) => ({
      id: id ?? "payment-doc-1",
    }));
  });

  it("claims PENDING to SUCCESS", async () => {
    stubListByStatus(PaymentStatus.PENDING);
    mockRunTransaction.mockImplementation(async (callback) => {
      const tx = {
        get: async () => ({
          exists: true,
          id: "payment-doc-1",
          data: () => paymentData(PaymentStatus.PENDING),
        }),
        update: vi.fn(),
      };
      return callback(tx);
    });
    // Post-claim read
    mockOrderByGet
      .mockResolvedValueOnce({
        docs: [{ id: "payment-doc-1", data: () => paymentData(PaymentStatus.PENDING) }],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "payment-doc-1",
            data: () => paymentData(PaymentStatus.SUCCESS),
          },
        ],
      });

    const result = await claimPaymentSuccessTransition(reference, {
      providerReference: "txn",
    });
    expect(result.outcome).toBe("claimed");
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it("returns already_settled when another caller already claimed SUCCESS", async () => {
    mockOrderByGet.mockResolvedValue({
      docs: [
        {
          id: "payment-doc-1",
          data: () => paymentData(PaymentStatus.SUCCESS),
        },
      ],
    });
    mockRunTransaction.mockImplementation(async (callback) => {
      const tx = {
        get: async () => ({
          exists: true,
          id: "payment-doc-1",
          data: () => paymentData(PaymentStatus.SUCCESS),
        }),
        update: vi.fn(),
      };
      return callback(tx);
    });

    const result = await claimPaymentSuccessTransition(reference);
    expect(result.outcome).toBe("already_settled");
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it("allows ABANDONED Paystack payments to be claimed for recovery", async () => {
    mockRunTransaction.mockImplementation(async (callback) => {
      const tx = {
        get: async () => ({
          exists: true,
          id: "payment-doc-1",
          data: () => paymentData(PaymentStatus.ABANDONED, "paystack"),
        }),
        update: vi.fn(),
      };
      return callback(tx);
    });
    mockOrderByGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "payment-doc-1",
            data: () => paymentData(PaymentStatus.ABANDONED, "paystack"),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "payment-doc-1",
            data: () => paymentData(PaymentStatus.SUCCESS, "paystack"),
          },
        ],
      });

    const result = await claimPaymentSuccessTransition(reference, {
      providerReference: reference,
    });
    expect(result.outcome).toBe("claimed");
    expect(result.payment.provider).toBe("paystack");
    expect(result.payment.status).toBe(PaymentStatus.SUCCESS);
  });

  it("serializes concurrent claims to one claimed and one already_settled", async () => {
    let liveStatus = PaymentStatus.PENDING;

    mockOrderByGet.mockImplementation(async () => ({
      docs: [
        {
          id: "payment-doc-1",
          data: () => paymentData(liveStatus),
        },
      ],
    }));

    mockRunTransaction.mockImplementation(async (callback) => {
      const tx = {
        get: async () => ({
          exists: true,
          id: "payment-doc-1",
          data: () => paymentData(liveStatus),
        }),
        update: () => {
          liveStatus = PaymentStatus.SUCCESS;
        },
      };
      return callback(tx);
    });

    const [first, second] = await Promise.all([
      claimPaymentSuccessTransition(reference, { providerReference: "txn" }),
      claimPaymentSuccessTransition(reference, { providerReference: "txn" }),
    ]);

    expect([first.outcome, second.outcome].sort()).toEqual([
      "already_settled",
      "claimed",
    ]);
  });
});
