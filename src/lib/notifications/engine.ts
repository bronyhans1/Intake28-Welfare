import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import {
  NotificationAudience,
  NotificationChannel,
  type EmitNotificationInput,
  type NotificationChannelDelivery,
} from "@/lib/notifications/types";

function buildChannelDeliveries(
  channels: NotificationChannel[],
): NotificationChannelDelivery[] {
  return channels.map((channel) => {
    if (channel === NotificationChannel.IN_APP) {
      return {
        channel,
        status: "sent",
        provider: "firestore",
        error: null,
      };
    }

    // Architecture only — Hubtel SMS, Email, and Push are not delivered yet.
    return {
      channel,
      status: "pending",
      provider: null,
      error: null,
    };
  });
}

/**
 * Unified notification engine.
 * Every module should emit through this function — never write notification_events directly.
 */
export async function emitNotification(
  input: EmitNotificationInput,
): Promise<{ notificationId: string }> {
  const channels = input.channels?.length
    ? input.channels
    : [NotificationChannel.IN_APP];

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.NOTIFICATION_EVENTS).doc();

  const document = sanitizeFirestoreData({
    eventType: input.eventType,
    audience: input.audience,
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    actorId: input.actorId,
    actorName: input.actorName,
    title: input.title.trim(),
    message: input.message.trim(),
    relatedModule: input.relatedModule,
    relatedRecordId: input.relatedRecordId ?? null,
    actionUrl: input.actionUrl ?? null,
    channels,
    channelDeliveries: buildChannelDeliveries(channels),
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("emitNotification", document);
  await ref.set(document);

  return { notificationId: ref.id };
}

/**
 * Fire-and-forget wrapper so domain workflows stay resilient if notification write fails.
 */
export async function emitNotificationSafe(
  input: EmitNotificationInput,
): Promise<void> {
  try {
    await emitNotification(input);
  } catch (error) {
    console.error("[notifications] Failed to emit notification", {
      eventType: input.eventType,
      memberId: input.memberId,
      error,
    });
  }
}

export function resolveNotificationAudience(
  value: string | null | undefined,
): NotificationAudience {
  if (value === NotificationAudience.MEMBER) {
    return NotificationAudience.MEMBER;
  }
  return NotificationAudience.EXECUTIVE;
}
