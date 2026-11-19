export { evaluateActivationEligibility } from "./eligibility";
export {
  findUserById,
  findUserByServiceNumber,
  findUserForActivation,
  updateUserOtpTracking,
  activateUserRecord,
} from "./repository";
export {
  setActivationContext,
  getActivationContext,
  updateActivationContext,
  requireActivationContext,
  clearActivationContext,
} from "./session";
export { logActivationAuditEvent } from "./audit";
export { getActivationAuthEmail } from "./auth-email";
export {
  sendActivationOtp,
  ensureActivationOtp,
  verifyActivationOtp,
} from "./otp-service";
export { completeMemberActivation } from "./complete";
