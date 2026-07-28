import type { TimelineEvent } from "@/components/timeline/types";
import type { ClaimLifecycleAuditEvent } from "@/types/claims";
import { sortClaimLifecycleAuditHistory } from "@/lib/claims/claim-lifecycle-audit";

/**
 * Adapts claim lifecycle audit history into generic timeline events.
 * Does not duplicate history — maps the Phase 4A source of truth only.
 */
export function claimAuditHistoryToTimelineEvents(
  auditHistory: ClaimLifecycleAuditEvent[] | null | undefined,
): TimelineEvent[] {
  return sortClaimLifecycleAuditHistory(auditHistory ?? []).map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    createdAt: event.createdAt,
    performedByName: event.performedByName,
    performedByRole: event.performedByRole,
    reason: event.reason,
    metadata: event.metadata,
  }));
}
