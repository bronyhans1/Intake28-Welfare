/**
 * Public Progression API.
 *
 * Recalculation entry point (use after contributions / membership changes):
 *   recalculateMembershipProgression(memberId)
 *
 * Constants are exported from the calculator directly so reading benefit/maturity
 * constants does not create a circular load through hooks ↔ engine.
 */

export {
  calculateBenefitPercentage,
  calculateProgressionFromContributions,
  MATURITY_SUCCESSFUL_MONTHS,
  FULL_BENEFIT_WELFARE_POINTS,
} from "@/lib/progression/calculator";

export {
  ProgressionEngine,
  calculate,
  calculateSafe,
  getProgressionSummary,
  recalculateMembershipProgression,
} from "@/lib/progression/engine";

export {
  getProgressionByMemberId,
  toProgressionSummary,
} from "@/lib/progression/repository";
