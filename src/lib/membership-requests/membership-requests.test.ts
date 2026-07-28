import { describe, expect, it } from "vitest";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { canAccessRoute } from "@/lib/auth/routes";
import { MembershipRequestAuditAction } from "@/lib/membership-requests/audit";
import {
  assertRequestIsPending,
  buildMemberCreateInputFromRequest,
  evaluateRequestAccessEligibility,
  EXISTING_MEMBER_ACTIVATE_MESSAGE,
  EXISTING_MEMBER_SIGN_IN_MESSAGE,
  findDuplicatePendingRequest,
  PENDING_MEMBERSHIP_REQUEST_MESSAGE,
  resolveExistingMemberRequestConflict,
} from "@/lib/membership-requests/duplicates";
import {
  canReviewMembershipRequests,
  canViewMembershipRequests,
} from "@/lib/membership-requests/repository";
import { NEW_MEMBER_DEFAULTS } from "@/lib/members/defaults";
import { createMemberSchema } from "@/lib/validators/member";
import {
  approveMembershipRequestSchema,
  declineMembershipRequestSchema,
  submitMembershipRequestSchema,
} from "@/lib/validators/membership-request";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import { MembershipRequestStatus } from "@/types/membership-request";

describe("membership request submission validation", () => {
  it("accepts a valid public request payload", () => {
    const result = submitMembershipRequestSchema.safeParse({
      fullName: "Ama Mensah",
      serviceNumberSuffix: "13990",
      phoneNumber: "0241234567",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBe("0241234567");
    }
  });

  it("requires full name, service number, and telephone", () => {
    const result = submitMembershipRequestSchema.safeParse({
      fullName: "",
      serviceNumberSuffix: "",
      phoneNumber: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid Ghana telephone numbers", () => {
    const result = submitMembershipRequestSchema.safeParse({
      fullName: "Ama Mensah",
      serviceNumberSuffix: "13990",
      phoneNumber: "12345",
    });

    expect(result.success).toBe(false);
  });
});

describe("membership request duplicate prevention", () => {
  const pending = [
    {
      status: MembershipRequestStatus.PENDING,
      serviceNumber: "IS/13990",
      phoneNumber: "0241234567",
    },
    {
      status: MembershipRequestStatus.APPROVED,
      serviceNumber: "IS/14000",
      phoneNumber: "0249999999",
    },
  ];

  it("blocks duplicate pending service numbers", () => {
    expect(
      findDuplicatePendingRequest(pending, {
        serviceNumber: "IS/13990",
        phoneNumber: "0240000000",
      }),
    ).toEqual(pending[0]);
  });

  it("blocks duplicate pending phone numbers", () => {
    expect(
      findDuplicatePendingRequest(pending, {
        serviceNumber: "IS/15000",
        phoneNumber: "0241234567",
      }),
    ).toEqual(pending[0]);
  });

  it("allows new requests when only approved/declined matches exist", () => {
    expect(
      findDuplicatePendingRequest(pending, {
        serviceNumber: "IS/14000",
        phoneNumber: "0249999999",
      }),
    ).toBeNull();
  });

  it("uses the awaiting-review message for pending duplicates", () => {
    expect(PENDING_MEMBERSHIP_REQUEST_MESSAGE).toBe(
      "Your membership request is currently awaiting review.",
    );
  });
});

describe("request access existing-member conflicts", () => {
  it("blocks an existing ACTIVE member", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: {
          status: UserStatus.ACTIVE,
          activationStatus: ActivationStatus.ACTIVATED,
        },
        hasPendingRequest: false,
      }),
    ).toEqual({
      allowed: false,
      message: EXISTING_MEMBER_SIGN_IN_MESSAGE,
      nextAction: "sign_in",
    });
  });

  it("blocks an existing member awaiting activation", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: {
          status: UserStatus.ACTIVE,
          activationStatus: ActivationStatus.PENDING,
        },
        hasPendingRequest: true,
      }),
    ).toEqual({
      allowed: false,
      message: EXISTING_MEMBER_ACTIVATE_MESSAGE,
      nextAction: "activate_account",
    });
  });

  it("blocks when an existing PENDING membership request is found", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: null,
        hasPendingRequest: true,
      }),
    ).toEqual({
      allowed: false,
      message: PENDING_MEMBERSHIP_REQUEST_MESSAGE,
      nextAction: null,
    });
  });

  it("allows a new applicant with no member and no pending request", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: null,
        hasPendingRequest: false,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks an existing SUSPENDED member", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: {
          status: UserStatus.SUSPENDED,
          activationStatus: ActivationStatus.ACTIVATED,
        },
        hasPendingRequest: false,
      }),
    ).toEqual({
      allowed: false,
      message: EXISTING_MEMBER_SIGN_IN_MESSAGE,
      nextAction: "sign_in",
    });
  });

  it("blocks an existing INACTIVE member", () => {
    expect(
      evaluateRequestAccessEligibility({
        existingMember: {
          status: UserStatus.INACTIVE,
          activationStatus: ActivationStatus.ACTIVATED,
        },
        hasPendingRequest: false,
      }),
    ).toEqual({
      allowed: false,
      message: EXISTING_MEMBER_SIGN_IN_MESSAGE,
      nextAction: "sign_in",
    });
  });

  it("directs ACTIVE activated members to Sign In", () => {
    const conflict = resolveExistingMemberRequestConflict({
      status: UserStatus.ACTIVE,
      activationStatus: ActivationStatus.ACTIVATED,
    });

    expect(conflict).toEqual({
      message: EXISTING_MEMBER_SIGN_IN_MESSAGE,
      nextAction: "sign_in",
    });
    expect(conflict.message).toBe(
      "You are already registered as a member. Please sign in.",
    );
  });

  it("directs approved members awaiting activation to Activate Account", () => {
    const conflict = resolveExistingMemberRequestConflict({
      status: UserStatus.ACTIVE,
      activationStatus: ActivationStatus.PENDING,
    });

    expect(conflict).toEqual({
      message: EXISTING_MEMBER_ACTIVATE_MESSAGE,
      nextAction: "activate_account",
    });
    expect(conflict.message).toBe(
      "Your membership has already been approved. Please activate your account.",
    );
  });

  it("treats pending activation as Activate Account even when status is inactive", () => {
    const conflict = resolveExistingMemberRequestConflict({
      status: UserStatus.INACTIVE,
      activationStatus: ActivationStatus.PENDING,
    });

    expect(conflict.nextAction).toBe("activate_account");
    expect(conflict.message).toBe(EXISTING_MEMBER_ACTIVATE_MESSAGE);
  });

  it("allows a new applicant when no pending request exists", () => {
    expect(
      findDuplicatePendingRequest(
        [
          {
            status: MembershipRequestStatus.DECLINED,
            serviceNumber: "IS/13990",
            phoneNumber: "0241234567",
          },
        ],
        {
          serviceNumber: "IS/20001",
          phoneNumber: "0241111222",
        },
      ),
    ).toBeNull();
  });
});

describe("membership request approval and decline", () => {
  it("only allows pending requests to be reviewed", () => {
    expect(() =>
      assertRequestIsPending(MembershipRequestStatus.PENDING, "approved"),
    ).not.toThrow();
    expect(() =>
      assertRequestIsPending(MembershipRequestStatus.APPROVED, "approved"),
    ).toThrow(/pending/i);
    expect(() =>
      assertRequestIsPending(MembershipRequestStatus.DECLINED, "declined"),
    ).toThrow(/pending/i);
  });

  it("requires remarks when declining", () => {
    expect(
      declineMembershipRequestSchema.safeParse({
        requestId: "req-1",
        remarks: "",
      }).success,
    ).toBe(false);

    expect(
      declineMembershipRequestSchema.safeParse({
        requestId: "req-1",
        remarks: "Incomplete details",
      }).success,
    ).toBe(true);
  });

  it("allows optional remarks on approval", () => {
    expect(
      approveMembershipRequestSchema.safeParse({
        requestId: "req-1",
      }).success,
    ).toBe(true);
  });
});

describe("member creation from approved request", () => {
  it("builds the same create-member payload used by admin add member", () => {
    const input = buildMemberCreateInputFromRequest({
      fullName: "Ama Mensah",
      serviceNumberSuffix: "13990",
      phoneNumber: "0241234567",
    });

    const parsed = createMemberSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe(UserRole.MEMBER);
      expect(parsed.data.fullName).toBe("Ama Mensah");
      expect(parsed.data.phoneNumber).toBe("0241234567");
    }
  });

  it("leaves new members pending activation", () => {
    expect(NEW_MEMBER_DEFAULTS.activationStatus).toBe(ActivationStatus.PENDING);
  });
});

describe("membership request permissions", () => {
  it("grants view and review to admin and treasurer", () => {
    expect(
      hasPermission(UserRole.ADMIN, Permission.VIEW_MEMBERSHIP_REQUESTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.ADMIN, Permission.REVIEW_MEMBERSHIP_REQUESTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.VIEW_MEMBERSHIP_REQUESTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.REVIEW_MEMBERSHIP_REQUESTS),
    ).toBe(true);
    expect(canViewMembershipRequests(UserRole.ADMIN)).toBe(true);
    expect(canReviewMembershipRequests(UserRole.TREASURER)).toBe(true);
  });

  it("denies members from viewing or reviewing requests", () => {
    expect(
      hasPermission(UserRole.MEMBER, Permission.VIEW_MEMBERSHIP_REQUESTS),
    ).toBe(false);
    expect(
      hasPermission(UserRole.MEMBER, Permission.REVIEW_MEMBERSHIP_REQUESTS),
    ).toBe(false);
    expect(canViewMembershipRequests(UserRole.MEMBER)).toBe(false);
    expect(canReviewMembershipRequests(UserRole.MEMBER)).toBe(false);
  });

  it("allows executives on the membership requests admin route", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/membership-requests")).toBe(
      true,
    );
    expect(
      canAccessRoute(UserRole.TREASURER, "/admin/membership-requests"),
    ).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, "/admin/membership-requests")).toBe(
      false,
    );
  });
});

describe("membership request audit actions", () => {
  it("defines submit, approve, decline, and member-created actions", () => {
    expect(MembershipRequestAuditAction.MEMBERSHIP_REQUEST_SUBMITTED).toBe(
      "membership_request_submitted",
    );
    expect(MembershipRequestAuditAction.MEMBERSHIP_REQUEST_APPROVED).toBe(
      "membership_request_approved",
    );
    expect(MembershipRequestAuditAction.MEMBERSHIP_REQUEST_DECLINED).toBe(
      "membership_request_declined",
    );
    expect(MembershipRequestAuditAction.MEMBER_CREATED_FROM_REQUEST).toBe(
      "member_created_from_request",
    );
  });
});
