import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentStatus } from "@/types/enums";
import {
  PAYMENT_ABANDONMENT_HOURS,
  abandonStalePendingPayments,
  isPaymentAbandonmentEligible,
} from "@/lib/payments/lifecycle";

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

describe("payment abandonment eligibility", () => {
  it("marks pending payments older than 24 hours as eligible", () => {
    const now = new Date("2026-06-19T12:00:00.000Z");

    expect(
      isPaymentAbandonmentEligible(
        {
          status: PaymentStatus.PENDING,
          createdAt: makeTimestamp("2026-06-18T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("ignores non-pending and recent payments", () => {
    const now = new Date("2026-06-18T12:00:00.000Z");

    expect(
      isPaymentAbandonmentEligible(
        {
          status: PaymentStatus.SUCCESS,
          createdAt: makeTimestamp("2026-06-17T10:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);

    expect(
      isPaymentAbandonmentEligible(
        {
          status: PaymentStatus.PENDING,
          createdAt: makeTimestamp("2026-06-18T11:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("uses a 24 hour threshold", () => {
    expect(PAYMENT_ABANDONMENT_HOURS).toBe(24);
  });
});

describe("abandonStalePendingPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ get: mockGet });
    mockGet.mockResolvedValue({ docs: [] });
  });

  it("updates stale pending payments to abandoned", async () => {
    const staleDoc = {
      id: "payment-1",
      data: () => ({
        status: PaymentStatus.PENDING,
        createdAt: makeTimestamp("2026-06-17T10:00:00.000Z"),
      }),
      ref: { update: mockUpdate },
    };
    const recentDoc = {
      id: "payment-2",
      data: () => ({
        status: PaymentStatus.PENDING,
        createdAt: makeTimestamp("2026-06-18T11:00:00.000Z"),
      }),
      ref: { update: mockUpdate },
    };

    mockGet.mockResolvedValue({ docs: [staleDoc, recentDoc] });

    const updated = await abandonStalePendingPayments(
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(updated).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.ABANDONED }),
    );
  });
});
