import { emitNotification } from "@/lib/notifications/engine";
import {
  formatNotificationEventLabel,
  formatNotificationMessage,
} from "@/lib/notifications/labels";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationModule,
} from "@/lib/notifications/types";
import type { SerializedReceipt } from "@/types/receipt";
import type { CurrentUser } from "@/types/auth";

type ReceiptNotificationEventType =
  | typeof NotificationEventType.RECEIPT_GENERATED
  | typeof NotificationEventType.RECEIPT_DOWNLOADED;

export async function emitReceiptNotificationEvent(input: {
  receipt: SerializedReceipt;
  actor: CurrentUser;
  eventType: ReceiptNotificationEventType;
}): Promise<void> {
  const title = formatNotificationEventLabel(input.eventType);
  const message = formatNotificationMessage({
    eventType: input.eventType,
    actorName: input.actor.fullName,
    memberName: input.receipt.memberName,
  });

  await emitNotification({
    eventType: input.eventType,
    audience: NotificationAudience.EXECUTIVE,
    memberId: input.receipt.memberId,
    memberName: input.receipt.memberName,
    serviceNumber: input.receipt.serviceNumber,
    actorId: input.actor.uid,
    actorName: input.actor.fullName,
    title,
    message,
    relatedModule: NotificationModule.RECEIPTS,
    relatedRecordId: input.receipt.id,
    actionUrl: `/admin/contributions`,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      receiptId: input.receipt.id,
      receiptNumber: input.receipt.receiptNumber,
      paymentReference: input.receipt.paymentReference,
      contributionId: input.receipt.contributionId,
      amount: input.receipt.amount,
    },
  });
}
