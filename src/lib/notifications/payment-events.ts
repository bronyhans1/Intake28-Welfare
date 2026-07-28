import { emitNotificationSafe } from "@/lib/notifications/engine";
import {
  buildContributionActionUrl,
  buildPaymentActionUrl,
  NOTIFICATION_EVENT_LABELS,
} from "@/lib/notifications/labels";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationModule,
} from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedPayment } from "@/types/payment";

export async function notifyContributionReceived(
  contribution: Pick<
    SerializedContribution,
    "id" | "memberId" | "memberName" | "serviceNumber" | "amount"
  >,
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await emitNotificationSafe({
    eventType: NotificationEventType.CONTRIBUTION_RECEIVED,
    audience: NotificationAudience.MEMBER,
    memberId: contribution.memberId,
    memberName: contribution.memberName,
    serviceNumber: contribution.serviceNumber,
    actorId: actor.uid,
    actorName: actor.fullName,
    title: NOTIFICATION_EVENT_LABELS[NotificationEventType.CONTRIBUTION_RECEIVED],
    message: `A contribution of GHS ${contribution.amount.toFixed(2)} has been recorded.`,
    relatedModule: NotificationModule.CONTRIBUTIONS,
    relatedRecordId: contribution.id,
    actionUrl: buildContributionActionUrl(contribution.id),
    channels: [NotificationChannel.IN_APP],
    metadata: {
      amount: contribution.amount,
    },
  });
}

export async function notifyPaymentRecorded(
  payment: Pick<
    SerializedPayment,
    "id" | "memberId" | "memberName" | "serviceNumber" | "amount" | "reference"
  >,
  actor: Pick<CurrentUser, "uid" | "fullName">,
): Promise<void> {
  await emitNotificationSafe({
    eventType: NotificationEventType.PAYMENT_RECORDED,
    audience: NotificationAudience.MEMBER,
    memberId: payment.memberId,
    memberName: payment.memberName,
    serviceNumber: payment.serviceNumber,
    actorId: actor.uid,
    actorName: actor.fullName,
    title: NOTIFICATION_EVENT_LABELS[NotificationEventType.PAYMENT_RECORDED],
    message: `Payment ${payment.reference} of GHS ${payment.amount.toFixed(2)} has been recorded.`,
    relatedModule: NotificationModule.PAYMENTS,
    relatedRecordId: payment.id,
    actionUrl: buildPaymentActionUrl(),
    channels: [NotificationChannel.IN_APP],
    metadata: {
      reference: payment.reference,
      amount: payment.amount,
    },
  });
}
