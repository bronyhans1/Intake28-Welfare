export {
  canManageMembers,
  canViewMembers,
  changeMemberStatus,
  createMember,
  getMemberById,
  listMembers,
  resetActivation,
  updateMember,
  updateMemberProfile,
} from "./repository";

export type { MemberListResult } from "./repository";
export type { SerializedMember } from "@/types/user";

export { MemberAuditAction } from "./audit";
export { NEW_MEMBER_DEFAULTS, buildNewMemberDocument } from "./defaults";
export {
  DUPLICATE_PHONE_NUMBER_ERROR,
  DUPLICATE_SERVICE_NUMBER_ERROR,
  findDuplicatePhoneNumber,
  findDuplicateServiceNumber,
  matchesMemberSearch,
} from "./duplicates";
