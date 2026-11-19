import {
  createReceipt,
  logReceiptGeneratedAudit,
} from "@/lib/receipts/repository";
import { emitReceiptNotificationEvent } from "@/lib/receipts/events";
import { NotificationEventType } from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedPayment } from "@/types/payment";
import type { SerializedReceipt } from "@/types/receipt";

export type ReceiptGenerationOutcome = "created" | "existing";

export interface ReceiptGenerationResult {
  outcome: ReceiptGenerationOutcome;
  receipt: SerializedReceipt | null;
}

export async function ensureReceiptFromPayment(
  payment: SerializedPayment,
  contribution: SerializedContribution,
  actor: CurrentUser,
): Promise<ReceiptGenerationResult> {
  const { receipt, created } = await createReceipt({
    paymentId: payment.id,
    paymentReference: payment.reference,
    contributionId: contribution.id,
    memberId: payment.memberId,
    memberName: payment.memberName,
    serviceNumber: payment.serviceNumber,
    contributionType: contribution.contributionType,
    amount: payment.amount,
    currency: payment.currency,
    issuedBy: actor.uid,
  });

  if (!created) {
    return { outcome: "existing", receipt };
  }

  await logReceiptGeneratedAudit(receipt, actor);
  await emitReceiptNotificationEvent({
    receipt,
    actor,
    eventType: NotificationEventType.RECEIPT_GENERATED,
  });

  return { outcome: "created", receipt };
}
