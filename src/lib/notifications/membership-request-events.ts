import { emitNotificationSafe } from "@/lib/notifications/engine";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationModule,
} from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";

export async function notifyNewMembershipRequest(input: {
  requestId: string;
  fullName: string;
  serviceNumber: string;
}): Promise<void> {
  await emitNotificationSafe({
    eventType: NotificationEventType.MEMBERSHIP_REQUEST_SUBMITTED,
    audience: NotificationAudience.EXECUTIVE,
    memberId: input.requestId,
    memberName: input.fullName,
    serviceNumber: input.serviceNumber,
    actorId: "public",
    actorName: input.fullName,
    title: "New Membership Request",
    message: `${input.fullName} (${input.serviceNumber}) requested access to the welfare portal.`,
    relatedModule: NotificationModule.SYSTEM,
    relatedRecordId: input.requestId,
    actionUrl: "/admin/membership-requests",
    channels: [NotificationChannel.IN_APP],
  });
}

export async function notifyMembershipRequestApproved(input: {
  memberId: string;
  fullName: string;
  serviceNumber: string;
  actor: Pick<CurrentUser, "uid" | "fullName">;
}): Promise<void> {
  await emitNotificationSafe({
    eventType: NotificationEventType.MEMBERSHIP_REQUEST_APPROVED,
    audience: NotificationAudience.MEMBER,
    memberId: input.memberId,
    memberName: input.fullName,
    serviceNumber: input.serviceNumber,
    actorId: input.actor.uid,
    actorName: input.actor.fullName,
    title: "Membership Request Approved",
    message:
      "Your membership request was approved. Use Activate Account with your service number to create your login credentials.",
    relatedModule: NotificationModule.SYSTEM,
    relatedRecordId: input.memberId,
    actionUrl: "/activate-account",
    channels: [NotificationChannel.IN_APP],
  });
}

export async function notifyMembershipRequestDeclined(input: {
  requestId: string;
  fullName: string;
  serviceNumber: string;
  remarks: string;
  actor: Pick<CurrentUser, "uid" | "fullName">;
}): Promise<void> {
  // Requester has no portal account yet — record an executive-visible notice.
  await emitNotificationSafe({
    eventType: NotificationEventType.MEMBERSHIP_REQUEST_DECLINED,
    audience: NotificationAudience.EXECUTIVE,
    memberId: input.requestId,
    memberName: input.fullName,
    serviceNumber: input.serviceNumber,
    actorId: input.actor.uid,
    actorName: input.actor.fullName,
    title: "Membership Request Declined",
    message: `Request from ${input.fullName} (${input.serviceNumber}) was declined. Reason: ${input.remarks}`,
    relatedModule: NotificationModule.SYSTEM,
    relatedRecordId: input.requestId,
    actionUrl: "/admin/membership-requests",
    channels: [NotificationChannel.IN_APP],
  });
}
