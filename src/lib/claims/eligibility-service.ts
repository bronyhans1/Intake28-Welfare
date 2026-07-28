/**
 * Loads member / claim-type / constitution data and runs the Eligibility Engine.
 * Keep I/O here; keep pure rules in eligibility-engine.ts.
 */

import { getClaimTypeConfigByCode } from "@/lib/claims/claim-type-repository";
import { getActiveConstitution } from "@/lib/claims/constitution-repository";
import {
  evaluateMemberEligibility,
  type MemberEligibilityResult,
} from "@/lib/claims/eligibility-engine";
import { getMemberById } from "@/lib/members/repository";

export async function evaluateMemberEligibilityForClaim(params: {
  memberId: string;
  claimTypeCode: string;
  asOf?: Date;
}): Promise<MemberEligibilityResult | { error: string }> {
  const member = await getMemberById(params.memberId);
  if (!member) {
    return { error: "Member not found." };
  }

  const claimType = await getClaimTypeConfigByCode(params.claimTypeCode);
  const constitution = await getActiveConstitution();

  return evaluateMemberEligibility({
    member: {
      status: member.status,
      isDefaulter: member.isDefaulter,
      parentInformationCompleted: member.parentInformationCompleted,
      motherFullName: member.motherFullName,
      motherStatus: member.motherStatus,
      fatherFullName: member.fatherFullName,
      fatherStatus: member.fatherStatus,
      fullName: member.fullName,
      phoneNumber: member.phoneNumber,
      email: member.email,
      dateOfBirth: member.dateOfBirth,
      rank: member.rank,
      station: member.station,
      nextOfKin: member.nextOfKin,
      emergencyContact: member.emergencyContact,
      profilePhotoUrl: member.profilePhotoUrl,
      activatedAt: member.activatedAt,
      createdAt: member.createdAt,
    },
    claimTypeConfig: claimType
      ? {
          waitingPeriodDays: claimType.waitingPeriodDays,
          benefitPercentage: claimType.benefitPercentage,
        }
      : null,
    constitution: constitution
      ? {
          displayName: constitution.displayName,
          versionNumber: constitution.versionNumber,
        }
      : null,
    asOf: params.asOf,
  });
}
