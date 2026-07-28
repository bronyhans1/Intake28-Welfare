import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaulters, listDefaulters } from "@/lib/finance/defaulters";
import { MembershipProgressionStatus } from "@/types/enums";

const mockGetMonthlyDuesAmount = vi.fn();
const mockListAllMembershipProgressions = vi.fn();
const mockCollection = vi.fn();
const mockGet = vi.fn();

vi.mock("@/lib/system-settings/repository", () => ({
  getMonthlyDuesAmount: () => mockGetMonthlyDuesAmount(),
}));

vi.mock("@/lib/progression/repository", () => ({
  listAllMembershipProgressions: () => mockListAllMembershipProgressions(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

function progression(
  overrides: Record<string, unknown> & { memberId: string },
) {
  return {
    welfarePoints: 3,
    benefitPercentage: 0,
    successfulContributionMonths: 3,
    consecutiveContributionMonths: 1,
    consecutiveMissedMonths: 0,
    outstandingContributionMonths: 2,
    outstandingMonths: [
      { month: 6, year: 2026 },
      { month: 7, year: 2026 },
    ],
    isMature: false,
    eligibleToClaim: false,
    membershipStatus: MembershipProgressionStatus.DEFAULTING,
    maturityDate: null,
    lastSuccessfulContributionDate: "2026-05-10T00:00:00.000Z",
    lastCalculatedAt: "2026-07-26T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("getDefaulters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonthlyDuesAmount.mockResolvedValue(50);
    mockCollection.mockReturnValue({ get: mockGet });
    mockGet.mockResolvedValue({
      docs: [
        {
          id: "m1",
          data: () => ({
            status: "active",
            fullName: "Mary Baah",
            serviceNumber: "IS/13989",
          }),
        },
        {
          id: "m2",
          data: () => ({
            status: "active",
            fullName: "Eva Danso",
            serviceNumber: "IS/13987",
          }),
        },
        {
          id: "m3",
          data: () => ({
            status: "suspended",
            fullName: "Suspended Member",
            serviceNumber: "IS/13980",
          }),
        },
      ],
    });
    mockListAllMembershipProgressions.mockResolvedValue([
      progression({ memberId: "m1" }),
      progression({
        memberId: "m2",
        outstandingContributionMonths: 0,
        outstandingMonths: [],
        membershipStatus: MembershipProgressionStatus.ACTIVE,
        lastSuccessfulContributionDate: "2026-07-01T00:00:00.000Z",
      }),
      progression({ memberId: "m3" }),
    ]);
  });

  it("lists active members with Progression Engine outstanding months", async () => {
    const defaulters = await getDefaulters();

    expect(defaulters).toHaveLength(1);
    expect(defaulters[0]).toMatchObject({
      memberId: "m1",
      fullName: "Mary Baah",
      serviceNumber: "IS/13989",
      outstandingMonths: 2,
      outstandingMonthLabels: ["June 2026", "July 2026"],
      outstandingMonthsDisplay: "June 2026 • July 2026",
      outstandingAmount: 100,
      membershipStatus: MembershipProgressionStatus.DEFAULTING,
      lastContributionDate: "2026-05-10T00:00:00.000Z",
    });
  });

  it("can filter to members owing a specific month", async () => {
    mockListAllMembershipProgressions.mockResolvedValue([
      progression({
        memberId: "m1",
        outstandingMonths: [{ month: 6, year: 2026 }],
        outstandingContributionMonths: 1,
      }),
      progression({
        memberId: "m2",
        outstandingMonths: [{ month: 7, year: 2026 }],
        outstandingContributionMonths: 1,
        membershipStatus: MembershipProgressionStatus.ACTIVE,
      }),
    ]);

    const june = await getDefaulters({ month: 6, year: 2026 });
    expect(june.map((row) => row.memberId)).toEqual(["m1"]);
  });
});

describe("listDefaulters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonthlyDuesAmount.mockResolvedValue(50);
    mockCollection.mockReturnValue({ get: mockGet });
    mockGet.mockResolvedValue({
      docs: Array.from({ length: 12 }, (_, index) => ({
        id: `m${index + 1}`,
        data: () => ({
          status: "active",
          fullName: `Member ${index + 1}`,
          serviceNumber: `IS/100${index + 1}`,
        }),
      })),
    });
    mockListAllMembershipProgressions.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) =>
        progression({
          memberId: `m${index + 1}`,
          outstandingContributionMonths: 1,
          outstandingMonths: [{ month: 7, year: 2026 }],
        }),
      ),
    );
  });

  it("paginates defaulter results", async () => {
    const page1 = await listDefaulters({ page: 1, pageSize: 5 });
    const page2 = await listDefaulters({ page: 2, pageSize: 5 });

    expect(page1.records).toHaveLength(5);
    expect(page1.total).toBe(12);
    expect(page1.totalPages).toBe(3);
    expect(page2.records).toHaveLength(5);
    expect(page2.page).toBe(2);
  });

  it("filters defaulters by search term", async () => {
    const result = await listDefaulters({
      page: 1,
      pageSize: 10,
      search: "Member 12",
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.fullName).toBe("Member 12");
  });
});
