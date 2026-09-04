import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRecalculate = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUsersGet = vi.fn();

vi.mock("@/lib/progression/engine", () => ({
  recalculateMembershipProgression: (...args: unknown[]) =>
    mockRecalculate(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      if (name === "system") {
        return {
          doc: () => ({
            get: mockGet,
            set: mockSet,
          }),
        };
      }
      return {
        get: mockUsersGet,
      };
    },
  }),
}));

vi.mock("@/lib/finance/period", async () => {
  const actual = await vi.importActual<typeof import("@/lib/finance/period")>(
    "@/lib/finance/period",
  );
  return {
    ...actual,
    getCurrentMonthYear: () => ({ month: 11, year: 2026 }),
  };
});

describe("runProgressionMonthBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecalculate.mockResolvedValue(undefined);
    mockSet.mockResolvedValue(undefined);
    mockUsersGet.mockResolvedValue({
      size: 2,
      docs: [{ id: "m1" }, { id: "m2" }],
    });
  });

  it("skips when already run for the current Accra month", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ lastAsOfKey: "2026-11" }),
    });

    const { runProgressionMonthBoundary } = await import(
      "@/lib/progression/month-boundary"
    );
    const result = await runProgressionMonthBoundary();

    expect(result.skippedAlreadyCurrent).toBe(true);
    expect(result.recalculated).toBe(0);
    expect(mockRecalculate).not.toHaveBeenCalled();
  });

  it("recalculates all members once per Accra month and persists state", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ lastAsOfKey: "2026-10" }),
    });

    const { runProgressionMonthBoundary } = await import(
      "@/lib/progression/month-boundary"
    );
    const result = await runProgressionMonthBoundary();

    expect(result.skippedAlreadyCurrent).toBe(false);
    expect(result.recalculated).toBe(2);
    expect(mockRecalculate).toHaveBeenCalledWith("m1");
    expect(mockRecalculate).toHaveBeenCalledWith("m2");
    expect(mockSet).toHaveBeenCalled();
  });

  it("force=true re-runs even when state matches", async () => {
    mockGet.mockResolvedValue({
      data: () => ({ lastAsOfKey: "2026-11" }),
    });

    const { runProgressionMonthBoundary } = await import(
      "@/lib/progression/month-boundary"
    );
    const result = await runProgressionMonthBoundary({ force: true });

    expect(result.skippedAlreadyCurrent).toBe(false);
    expect(result.recalculated).toBe(2);
  });
});
