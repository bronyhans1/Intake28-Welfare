import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentType } from "@/types/enums";

const mockFindPaidMonthlyDuesContribution = vi.fn();

vi.mock("@/lib/contributions/repository", () => ({
  findPaidMonthlyDuesContribution: (...args: unknown[]) =>
    mockFindPaidMonthlyDuesContribution(...args),
}));

vi.mock("@/lib/finance/period", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/finance/period")>();
  return {
    ...actual,
    getCurrentMonthYear: () => ({ month: 6, year: 2026 }),
  };
});

import {
  assertMonthlyDuesPaymentAllowed,
  formatMonthlyDuesAlreadyPaidMessage,
  getMonthlyDuesPaymentGuardStatus,
} from "@/lib/payments/monthly-dues-guard";

describe("formatMonthlyDuesAlreadyPaidMessage", () => {
  it("formats the business month message", () => {
    expect(formatMonthlyDuesAlreadyPaidMessage(6, 2026)).toBe(
      "Your monthly dues for June 2026 have already been paid.",
    );
  });
});

describe("getMonthlyDuesPaymentGuardStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paid status when monthly dues exist", async () => {
    mockFindPaidMonthlyDuesContribution.mockResolvedValue({ id: "c1" });

    const status = await getMonthlyDuesPaymentGuardStatus("member-1");

    expect(status.isPaid).toBe(true);
    expect(status.message).toBe(
      "Your monthly dues for June 2026 have already been paid.",
    );
    expect(mockFindPaidMonthlyDuesContribution).toHaveBeenCalledWith("member-1", 6, 2026);
  });

  it("returns unpaid status when no monthly dues exist", async () => {
    mockFindPaidMonthlyDuesContribution.mockResolvedValue(null);

    const status = await getMonthlyDuesPaymentGuardStatus("member-1");

    expect(status.isPaid).toBe(false);
    expect(status.message).toBeNull();
  });
});

describe("assertMonthlyDuesPaymentAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindPaidMonthlyDuesContribution.mockResolvedValue(null);
  });

  it("allows special contribution payments", async () => {
    await expect(
      assertMonthlyDuesPaymentAllowed("member-1", PaymentType.SPECIAL_CONTRIBUTION),
    ).resolves.toBeUndefined();
    expect(mockFindPaidMonthlyDuesContribution).not.toHaveBeenCalled();
  });

  it("blocks monthly dues when already paid", async () => {
    mockFindPaidMonthlyDuesContribution.mockResolvedValue({ id: "c1" });

    await expect(
      assertMonthlyDuesPaymentAllowed("member-1", PaymentType.MONTHLY_DUES),
    ).rejects.toThrow("Your monthly dues for June 2026 have already been paid.");
  });
});
