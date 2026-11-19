import { MembershipRequestStatus } from "@/types/membership-request";
import type { MembershipRequest } from "@/types/membership-request";
import type { CreateMemberFormInput } from "@/lib/validators/member";
import { ActivationStatus, UserRole } from "@/types/enums";

type PendingDuplicateCandidate = Pick<
  MembershipRequest,
  "status" | "serviceNumber" | "phoneNumber"
>;

export const PENDING_MEMBERSHIP_REQUEST_MESSAGE =
  "Your membership request is currently awaiting review." as const;

export const EXISTING_MEMBER_SIGN_IN_MESSAGE =
  "You are already registered as a member. Please sign in." as const;

export const EXISTING_MEMBER_ACTIVATE_MESSAGE =
  "Your membership has already been approved. Please activate your account." as const;

export type MembershipRequestNextAction = "sign_in" | "activate_account";

export class MembershipRequestConflictError extends Error {
  readonly nextAction: MembershipRequestNextAction | null;

  constructor(
    message: string,
    nextAction: MembershipRequestNextAction | null = null,
  ) {
    super(message);
    this.name = "MembershipRequestConflictError";
    this.nextAction = nextAction;
  }
}

/**
 * Maps an existing member record to the Request Access conflict response.
 * Pending activation always directs the user to Activate Account.
 */
export function resolveExistingMemberRequestConflict(member: {
  status?: string | null;
  activationStatus?: string | null;
}): {
  message: string;
  nextAction: MembershipRequestNextAction;
} {
  if (member.activationStatus === ActivationStatus.PENDING) {
    return {
      message: EXISTING_MEMBER_ACTIVATE_MESSAGE,
      nextAction: "activate_account",
    };
  }

  return {
    message: EXISTING_MEMBER_SIGN_IN_MESSAGE,
    nextAction: "sign_in",
  };
}

/**
 * Pure Request Access gate — mirrors backend validation order:
 * 1. Existing member (any status) → block
 * 2. Pending membership request → block
 * 3. Otherwise allow submission
 */
export function evaluateRequestAccessEligibility(input: {
  existingMember: {
    status?: string | null;
    activationStatus?: string | null;
  } | null;
  hasPendingRequest: boolean;
}):
  | { allowed: true }
  | {
      allowed: false;
      message: string;
      nextAction: MembershipRequestNextAction | null;
    } {
  if (input.existingMember) {
    const conflict = resolveExistingMemberRequestConflict(input.existingMember);
    return {
      allowed: false,
      message: conflict.message,
      nextAction: conflict.nextAction,
    };
  }

  if (input.hasPendingRequest) {
    return {
      allowed: false,
      message: PENDING_MEMBERSHIP_REQUEST_MESSAGE,
      nextAction: null,
    };
  }

  return { allowed: true };
}

/**
 * Finds a pending request that collides on service number or phone.
 */
export function findDuplicatePendingRequest(
  requests: PendingDuplicateCandidate[],
  input: { serviceNumber: string; phoneNumber: string },
): PendingDuplicateCandidate | null {
  return (
    requests.find(
      (request) =>
        request.status === MembershipRequestStatus.PENDING &&
        (request.serviceNumber === input.serviceNumber ||
          request.phoneNumber === input.phoneNumber),
    ) ?? null
  );
}

export function assertRequestIsPending(
  status: MembershipRequestStatus,
  action: "approved" | "declined",
): void {
  if (status !== MembershipRequestStatus.PENDING) {
    throw new Error(`Only pending requests can be ${action}.`);
  }
}

/**
 * Maps an approved request into the same create-member payload
 * used by the admin "Add Member" flow (inactive activation).
 */
export function buildMemberCreateInputFromRequest(request: {
  fullName: string;
  serviceNumberSuffix: string;
  phoneNumber: string;
}): CreateMemberFormInput {
  return {
    serviceNumberSuffix: request.serviceNumberSuffix,
    fullName: request.fullName,
    phoneNumber: request.phoneNumber,
    role: UserRole.MEMBER,
    dateOfBirth: "",
    gender: "",
    rank: "",
    station: "",
    nextOfKin: "",
    emergencyContact: "",
  };
}
