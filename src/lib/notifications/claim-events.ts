import { emitNotificationSafe } from "@/lib/notifications/engine";
import { buildMemberClaimNotification } from "@/lib/notifications/labels";
import { NotificationEventType } from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";

type ClaimNotifyTarget = {
  id: string;
  claimNumber?: string | null;
  memberId: string;
  memberName: string;
  serviceNumber: string;
};

async function notifyClaimMember(input: {
  eventType:
    | typeof NotificationEventType.CLAIM_SUBMITTED
    | typeof NotificationEventType.CLAIM_RETURNED
    | typeof NotificationEventType.CLAIM_APPROVED
    | typeof NotificationEventType.CLAIM_REJECTED
    | typeof NotificationEventType.CLAIM_SENT_TO_FINANCE
    | typeof NotificationEventType.CLAIM_PAID;
  claim: ClaimNotifyTarget;
  actor: Pick<CurrentUser, "uid" | "fullName">;
  extraMessage?: string | null;
}): Promise<void> {
  const claimNumber = input.claim.claimNumber ?? input.claim.id;
  await emitNotificationSafe(
    buildMemberClaimNotification({
      eventType: input.eventType,
      claimId: input.claim.id,
      claimNumber,
      memberId: input.claim.memberId,
      memberName: input.claim.memberName,
      serviceNumber: input.claim.serviceNumber,
      actorId: input.actor.uid,
      actorName: input.actor.fullName,
      extraMessage: input.extraMessage,
    }),
  );
}

export async function notifyClaimSubmitted(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_SUBMITTED,
    claim,
    actor,
    extraMessage: "Your claim has been submitted for review.",
  });
}

export async function notifyClaimReturned(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
  reason?: string | null,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_RETURNED,
    claim,
    actor,
    extraMessage: reason
      ? `Reason: ${reason}`
      : "Please revise and resubmit your claim.",
  });
}

export async function notifyClaimApproved(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_APPROVED,
    claim,
    actor,
    extraMessage: "Your claim has been approved and sent to Finance.",
  });
}

export async function notifyClaimRejected(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
  reason?: string | null,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_REJECTED,
    claim,
    actor,
    extraMessage: reason ? `Reason: ${reason}` : null,
  });
}

export async function notifyClaimSentToFinance(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_SENT_TO_FINANCE,
    claim,
    actor,
    extraMessage: "Finance will process your payment.",
  });
}

export async function notifyClaimPaid(
  claim: ClaimNotifyTarget,
  actor: Pick<CurrentUser, "uid" | "fullName">,
  amount?: number | null,
): Promise<void> {
  await notifyClaimMember({
    eventType: NotificationEventType.CLAIM_PAID,
    claim,
    actor,
    extraMessage:
      typeof amount === "number"
        ? `Amount paid: GHS ${amount.toFixed(2)}.`
        : "Your claim payment has been recorded.",
  });
}
