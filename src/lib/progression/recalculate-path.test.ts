import { beforeEach, describe, expect, it, vi } from "vitest";

const runSpy = vi.fn();

vi.mock("@/lib/members/repository", () => ({
  getMemberById: vi.fn().mockResolvedValue({
    id: "member-1",
    activatedAt: "2026-01-15T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  }),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getSystemSettings: vi.fn().mockResolvedValue({
    defaulterThresholdMonths: 2,
  }),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: () => ({
      where: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  }),
}));

vi.mock("@/lib/progression/repository", () => ({
  getProgressionByMemberId: vi.fn().mockResolvedValue(null),
  upsertMembershipProgression: vi.fn(async (result) => {
    runSpy(result);
    return {
      ...result,
      outstandingMonths: result.outstandingMonths ?? [],
      outstandingContributionMonths: result.outstandingContributionMonths ?? 0,
      lastCalculatedAt: "2026-07-26T00:00:00.000Z",
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    };
  }),
  syncMemberDefaulterFields: vi.fn().mockResolvedValue(undefined),
  toProgressionSummary: vi.fn((record) => record),
}));

vi.mock("@/lib/finance/period", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/finance/period")>();
  return {
    ...actual,
    getCurrentMonthYear: () => ({ month: 5, year: 2026 }),
  };
});

describe("recalculateMembershipProgression single path", () => {
  beforeEach(() => {
    runSpy.mockClear();
  });

  it("hooks re-export invokes engine calculate without 'calculate is not a function'", async () => {
    // Import constants first (previously pulled the barrel into a circular init).
    await import("@/lib/progression/calculator");
    const { recalculateMembershipProgression } = await import(
      "@/lib/progression/hooks"
    );

    await expect(
      recalculateMembershipProgression("member-1"),
    ).resolves.toBeUndefined();

    expect(runSpy).toHaveBeenCalled();
    expect(typeof recalculateMembershipProgression).toBe("function");
  });

  it("barrel recalculateMembershipProgression is the same engine entry point", async () => {
    const barrel = await import("@/lib/progression");
    const engine = await import("@/lib/progression/engine");

    expect(barrel.recalculateMembershipProgression).toBe(
      engine.recalculateMembershipProgression,
    );
    expect(typeof engine.calculate).toBe("function");
    expect(typeof engine.ProgressionEngine.calculate).toBe("function");
  });
});
