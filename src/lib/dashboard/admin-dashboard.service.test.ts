import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivationStatus, UserStatus } from "@/types/enums";

const mockGet = vi.fn();
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/audit/actor", () => ({
  resolveAuditActorDisplayName: vi.fn().mockResolvedValue("Resolved Actor"),
}));

const { getAdminMemberOverview, getMemberStats, getRecentMembers } = await import(
  "@/lib/dashboard/admin-dashboard.service"
);

function makeUserDoc(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    data: () => ({
      fullName: `User ${id}`,
      serviceNumber: `IS/${id}`,
      status: UserStatus.ACTIVE,
      activationStatus: ActivationStatus.ACTIVATED,
      role: "member",
      createdAt: { toDate: () => new Date("2026-08-01T00:00:00.000Z") },
      ...overrides,
    }),
  };
}

describe("admin dashboard member overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderBy.mockReturnValue({ get: mockGet });
    mockCollection.mockReturnValue({ orderBy: mockOrderBy });
    mockGet.mockResolvedValue({
      docs: [
        makeUserDoc("1"),
        makeUserDoc("2", {
          status: UserStatus.SUSPENDED,
          activationStatus: ActivationStatus.PENDING,
        }),
        makeUserDoc("3", {
          status: UserStatus.ACTIVE,
          activationStatus: ActivationStatus.PENDING,
        }),
      ],
    });
  });

  it("loads users once and derives stats, recent members, and name map", async () => {
    const overview = await getAdminMemberOverview(2);

    expect(mockCollection).toHaveBeenCalledTimes(1);
    expect(overview.stats).toEqual({
      totalMembers: 3,
      activeMembers: 2,
      pendingActivation: 2,
      suspendedMembers: 1,
    });
    expect(overview.recentMembers).toHaveLength(2);
    expect(overview.memberNames.get("1")?.fullName).toBe("User 1");
    expect(overview.memberNames.get("2")?.serviceNumber).toBe("IS/2");
  });

  it("keeps standalone getMemberStats / getRecentMembers behavior", async () => {
    await expect(getMemberStats()).resolves.toMatchObject({ totalMembers: 3 });
    await expect(getRecentMembers(1)).resolves.toHaveLength(1);
    expect(mockCollection).toHaveBeenCalledTimes(2);
  });
});
