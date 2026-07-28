import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClaimCommentVisibility,
  ClaimStatus,
  UserRole,
} from "@/types/enums";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import {
  appendClaimLifecycleAuditHistory,
  ClaimLifecycleAuditType,
} from "@/lib/claims/claim-lifecycle-audit";
import {
  canApproveClaim,
  canRecommendClaim,
  canRejectClaim,
  canReviewClaims,
  canStartClaimReview,
  filterAuditHistoryForMemberView,
  getMemberVisibleComments,
} from "@/lib/claims/claim-access";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import { Permission, hasPermission } from "@/lib/auth/permissions";
import { resolveTimelineEventTitle } from "@/components/timeline/event-config";
import { claimMatchesSearch } from "@/lib/claims/claim-repository";

const mockCreateAuditLog = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockGetMemberById = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firestore/sanitize", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/firestore/sanitize")
  >("@/lib/firestore/sanitize");
  return {
    ...actual,
    warnInvalidFirestorePayload: vi.fn(),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/claims/eligibility-service", () => ({
  evaluateMemberEligibilityForClaim: vi.fn(),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn(async () => ({
    code: "medical",
    displayName: "Medical",
    amountMode: "fixed",
    fixedAmount: 500,
  })),
}));

// Import after mocks so repository/admin wiring uses the stubs above.
const {
  addExecutiveComment,
  approveClaim,
  assignClaimExecutive,
  recommendClaim,
  rejectClaim,
  startClaimReview,
} = await import("@/lib/claims/claim-executive-review");

const executiveActor = {
  uid: "exec-1",
  fullName: "Executive User",
  role: UserRole.TREASURER,
  serviceNumber: "IS/2",
  email: "exec@example.com",
};

const adminActor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/1",
  email: "admin@example.com",
};

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/13984",
  email: "member@example.com",
};

const submittedData = {
  reference: "GIS-2026-00010",
  claimNumber: "GIS-2026-00010",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/13984",
  claimTypeCode: "medical",
  claimTypeDisplayName: "Medical",
  status: ClaimStatus.SUBMITTED,
  title: "Hospital visit",
  description: "Required surgery support",
  incidentDate: "2026-07-01",
  submittedAt: "2026-07-10T12:00:00.000Z",
  auditHistory: [
    {
      id: "cae_1",
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      title: "Claim Submitted",
      performedByUserId: "member-1",
      performedByName: "Member User",
      performedByRole: UserRole.MEMBER,
      createdAt: "2026-07-10T12:00:00.000Z",
      reason: null,
      metadata: {},
    },
  ],
  executiveComments: [],
  currency: "GHS",
  recommendedAmount: 500,
  claimCeiling: 1000,
  progressionSnapshot: {
    welfarePoints: 18,
    benefitPercentage: 50,
    membershipStatus: "ACTIVE",
    isMature: true,
    eligibleToClaim: true,
    recommendedAmount: 500,
    claimCeiling: 1000,
    calculatedAt: "2026-07-10T12:00:00.000Z",
  },
  createdBy: "member-1",
  createdByName: "Member User",
  createdAt: { seconds: 1, nanoseconds: 0 },
  updatedAt: { seconds: 1, nanoseconds: 0 },
};

function mockClaimDoc(data: Record<string, unknown>) {
  mockGet.mockResolvedValue({
    exists: true,
    id: "claim-1",
    data: () => ({ ...data }),
  });
}

describe("Phase 5 executive review permissions", () => {
  it("grants review and assign permissions to admin and treasurer only", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.REVIEW_CLAIMS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.ASSIGN_CLAIMS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.REVIEW_CLAIMS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.TREASURER, Permission.ASSIGN_CLAIMS)).toBe(
      true,
    );
    expect(hasPermission(UserRole.MEMBER, Permission.REVIEW_CLAIMS)).toBe(false);
    expect(hasPermission(UserRole.MEMBER, Permission.ASSIGN_CLAIMS)).toBe(false);
    expect(canReviewClaims(UserRole.MEMBER)).toBe(false);
  });

  it("allows status transitions for review workflow", () => {
    expect(canStartClaimReview(ClaimStatus.SUBMITTED)).toBe(true);
    expect(canStartClaimReview(ClaimStatus.UNDER_REVIEW)).toBe(false);
    expect(canRecommendClaim(ClaimStatus.UNDER_REVIEW)).toBe(true);
    expect(canRecommendClaim(ClaimStatus.SUBMITTED)).toBe(false);
    expect(canApproveClaim(ClaimStatus.SUBMITTED)).toBe(true);
    expect(canApproveClaim(ClaimStatus.UNDER_REVIEW)).toBe(true);
    expect(canApproveClaim(ClaimStatus.RECOMMENDED)).toBe(true);
    expect(canRejectClaim(ClaimStatus.RECOMMENDED)).toBe(true);
    expect(canApproveClaim(ClaimStatus.APPROVED)).toBe(false);
  });
});

describe("Phase 5 comment visibility", () => {
  it("hides internal comments from members and shows member-visible ones", () => {
    const comments = [
      {
        id: "c1",
        body: "Internal note",
        visibility: ClaimCommentVisibility.INTERNAL,
        authorId: "exec-1",
        authorName: "Executive User",
        authorRole: UserRole.TREASURER,
        createdAt: "2026-07-11T10:00:00.000Z",
      },
      {
        id: "c2",
        body: "Please confirm hospital receipt",
        visibility: ClaimCommentVisibility.MEMBER_VISIBLE,
        authorId: "exec-1",
        authorName: "Executive User",
        authorRole: UserRole.TREASURER,
        createdAt: "2026-07-11T11:00:00.000Z",
      },
    ];

    expect(getMemberVisibleComments(comments)).toHaveLength(1);
    expect(getMemberVisibleComments(comments)[0].body).toContain("receipt");
  });

  it("filters internal executive comment events from member timeline", () => {
    const events = [
      {
        id: "e1",
        type: ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW,
        metadata: {},
      },
      {
        id: "e2",
        type: ClaimLifecycleAuditType.EXECUTIVE_COMMENT_ADDED,
        metadata: { visibility: ClaimCommentVisibility.INTERNAL },
      },
      {
        id: "e3",
        type: ClaimLifecycleAuditType.EXECUTIVE_COMMENT_ADDED,
        metadata: { visibility: ClaimCommentVisibility.MEMBER_VISIBLE },
      },
    ];

    const filtered = filterAuditHistoryForMemberView(events);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.id)).toEqual(["e1", "e3"]);
  });
});

describe("Phase 5 ActivityTimeline audit mapping", () => {
  it("maps executive review audit events for the timeline", () => {
    const history = [
      {
        id: "cae_a",
        type: ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW,
        title: "Review Started",
        performedByUserId: "exec-1",
        performedByName: "Executive User",
        performedByRole: UserRole.TREASURER,
        createdAt: "2026-07-11T09:00:00.000Z",
        reason: null,
        metadata: {},
      },
      {
        id: "cae_b",
        type: ClaimLifecycleAuditType.CLAIM_APPROVED,
        title: "Claim Approved",
        performedByUserId: "exec-1",
        performedByName: "Executive User",
        performedByRole: UserRole.TREASURER,
        createdAt: "2026-07-12T09:00:00.000Z",
        reason: null,
        metadata: {},
      },
    ];

    const timeline = claimAuditHistoryToTimelineEvents(history);
    expect(timeline).toHaveLength(2);
    expect(resolveTimelineEventTitle(timeline[0])).toBe("Review Started");
    expect(resolveTimelineEventTitle(timeline[1])).toBe("Claim Approved");
  });

  it("keeps audit history append-only", () => {
    const first = {
      id: "cae_1",
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      title: "Claim Submitted",
      performedByUserId: "member-1",
      performedByName: "Member User",
      performedByRole: UserRole.MEMBER,
      createdAt: "2026-07-10T12:00:00.000Z",
      reason: null,
      metadata: {},
    };
    const second = {
      id: "cae_2",
      type: ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW,
      title: "Review Started",
      performedByUserId: "exec-1",
      performedByName: "Executive User",
      performedByRole: UserRole.TREASURER,
      createdAt: "2026-07-11T09:00:00.000Z",
      reason: null,
      metadata: {},
    };

    const appended = appendClaimLifecycleAuditHistory([first], second);
    expect(appended).toHaveLength(2);
    expect(appended[0].id).toBe("cae_1");
    expect(appended[1].id).toBe("cae_2");
  });
});

describe("Phase 5 executive review repository actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockUpdate.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
  });

  it(
    "starts review and sets Under Review with audit event",
    async () => {
      mockClaimDoc(submittedData);

      await startClaimReview("claim-1", executiveActor as never);

      expect(mockUpdate).toHaveBeenCalled();
      const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.status).toBe(ClaimStatus.UNDER_REVIEW);
      expect(payload.reviewedById).toBe("exec-1");
      expect(payload.reviewedByName).toBe("Executive User");
      const history = payload.auditHistory as Array<{ type: string }>;
      expect(
        history.some(
          (e) => e.type === ClaimLifecycleAuditType.CLAIM_UNDER_REVIEW,
        ),
      ).toBe(true);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: ClaimsAuditAction.CLAIM_REVIEW_STARTED,
        }),
      );
    },
  );

  it("adds executive comments append-only with visibility metadata", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.UNDER_REVIEW,
    });

    await addExecutiveComment(
      "claim-1",
      {
        body: "Internal check complete",
        visibility: ClaimCommentVisibility.INTERNAL,
      },
      executiveActor as never,
    );

    expect(mockUpdate).toHaveBeenCalled();
    const payload = mockUpdate.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const comments = payload.executiveComments as Array<{
      body: string;
      visibility: string;
    }>;
    expect(comments).toHaveLength(1);
    expect(comments[0].visibility).toBe(ClaimCommentVisibility.INTERNAL);
    const history = payload.auditHistory as Array<{
      type: string;
      metadata: { visibility?: string };
    }>;
    const commentEvent = history.find(
      (e) => e.type === ClaimLifecycleAuditType.EXECUTIVE_COMMENT_ADDED,
    );
    expect(commentEvent?.metadata.visibility).toBe(
      ClaimCommentVisibility.INTERNAL,
    );
  });

  it("recommends, approves, and rejects claims with audit events", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.UNDER_REVIEW,
    });
    await recommendClaim("claim-1", executiveActor as never);
    expect(mockUpdate.mock.calls[0][0].status).toBe(ClaimStatus.RECOMMENDED);

    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.RECOMMENDED,
      auditHistory: submittedData.auditHistory,
    });
    await approveClaim(
      "claim-1",
      { decision: "recommended" },
      executiveActor as never,
    );
    expect(mockUpdate.mock.calls[1][0].status).toBe(ClaimStatus.AWAITING_PAYMENT);
    expect(mockUpdate.mock.calls[1][0].approvedById).toBe("exec-1");

    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.UNDER_REVIEW,
      auditHistory: submittedData.auditHistory,
    });
    await rejectClaim(
      "claim-1",
      { rejectionReason: "Insufficient supporting evidence." },
      executiveActor as never,
    );
    expect(mockUpdate.mock.calls[2][0].status).toBe(ClaimStatus.REJECTED);
    expect(mockUpdate.mock.calls[2][0].rejectionReason).toBe(
      "Insufficient supporting evidence.",
    );
  });

  it("requires a rejection reason", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.UNDER_REVIEW,
    });

    await expect(
      rejectClaim("claim-1", { rejectionReason: "   " }, executiveActor as never),
    ).rejects.toThrow(/rejection reason/i);
  });

  it("assigns an executive and creates an audit event", async () => {
    mockClaimDoc(submittedData);
    mockGetMemberById.mockResolvedValue({
      id: "exec-2",
      fullName: "Second Executive",
      role: UserRole.ADMIN,
      serviceNumber: "IS/3",
    });

    await assignClaimExecutive(
      "claim-1",
      { assignedExecutiveId: "exec-2" },
      adminActor as never,
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.assignedExecutiveId).toBe("exec-2");
    expect(payload.assignedExecutiveName).toBe("Second Executive");
    expect(payload.assignedById).toBe("admin-1");
    const history = payload.auditHistory as Array<{ type: string }>;
    expect(
      history.some((e) => e.type === ClaimLifecycleAuditType.EXECUTIVE_ASSIGNED),
    ).toBe(true);
  });

  it("blocks members from performing executive review actions", async () => {
    mockClaimDoc(submittedData);

    await expect(
      startClaimReview("claim-1", memberActor as never),
    ).rejects.toThrow(/permission/i);

    await expect(
      approveClaim(
        "claim-1",
        { decision: "recommended" },
        memberActor as never,
      ),
    ).rejects.toThrow(/permission/i);
  });

  it("allows direct approval from submitted without recommendation", async () => {
    mockClaimDoc(submittedData);

    await approveClaim(
      "claim-1",
      { decision: "recommended" },
      executiveActor as never,
    );
    expect(mockUpdate.mock.calls[0][0].status).toBe(
      ClaimStatus.AWAITING_PAYMENT,
    );
    expect(mockUpdate.mock.calls[0][0].approvedBenefitAmount).toBe(500);
  });
});

describe("Phase 5 search includes assigned executive and status", () => {
  it("matches assigned executive name and status", () => {
    const claim = {
      title: "Hospital visit",
      description: "Surgery",
      reference: "GIS-2026-00010",
      claimNumber: "GIS-2026-00010",
      memberName: "Member User",
      serviceNumber: "IS/13984",
      claimTypeCode: "medical",
      claimTypeDisplayName: "Medical",
      assignedExecutiveName: "Executive User",
      status: ClaimStatus.UNDER_REVIEW,
    };

    expect(claimMatchesSearch(claim, "Executive User")).toBe(true);
    expect(claimMatchesSearch(claim, "under_review")).toBe(true);
    expect(claimMatchesSearch(claim, "under review")).toBe(true);
    expect(claimMatchesSearch(claim, "nobody")).toBe(false);
  });
});
