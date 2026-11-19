/**
 * Compatibility re-export — prefer importing from `@/lib/progression` or
 * `@/lib/progression/engine`. Implementation lives on the ProgressionEngine module
 * so there is only one recalculation path.
 */
export { recalculateMembershipProgression } from "@/lib/progression/engine";
