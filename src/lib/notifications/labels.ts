import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationModule,
  type EmitNotificationInput,
  type NotificationEventType as NotificationEventTypeValue,
} from "@/lib/notifications/types";

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventTypeValue, string> =
  {
    [NotificationEventType.PROFILE_EMAIL_CHANGED]: "Email changed",
    [NotificationEventType.PROFILE_PHONE_CHANGED]: "Phone changed",
    [NotificationEventType.PROFILE_PHOTO_CHANGED]: "Profile photo updated",
    [NotificationEventType.PROFILE_RANK_CHANGED]: "Rank changed",
    [NotificationEventType.PROFILE_STATION_CHANGED]: "Station changed",
    [NotificationEventType.PROFILE_NEXT_OF_KIN_CHANGED]: "Next of Kin changed",
    [NotificationEventType.PROFILE_EMERGENCY_CONTACT_CHANGED]:
      "Emergency Contact changed",
    [NotificationEventType.RECEIPT_GENERATED]: "Receipt generated",
    [NotificationEventType.RECEIPT_DOWNLOADED]: "Receipt downloaded",
    [NotificationEventType.CLAIM_SUBMITTED]: "Claim Submitted",
    [NotificationEventType.CLAIM_RETURNED]: "Claim Returned",
    [NotificationEventType.CLAIM_APPROVED]: "Claim Approved",
    [NotificationEventType.CLAIM_REJECTED]: "Claim Rejected",
    [NotificationEventType.CLAIM_SENT_TO_FINANCE]: "Claim Sent to Finance",
    [NotificationEventType.CLAIM_PAID]: "Claim Paid",
    [NotificationEventType.CONTRIBUTION_RECEIVED]: "Contribution Received",
    [NotificationEventType.PAYMENT_RECORDED]: "Payment Recorded",
    [NotificationEventType.ANNOUNCEMENT_PUBLISHED]: "Announcement Published",
    [NotificationEventType.MEMBERSHIP_REQUEST_SUBMITTED]:
      "New Membership Request",
    [NotificationEventType.MEMBERSHIP_REQUEST_APPROVED]:
      "Membership Request Approved",
    [NotificationEventType.MEMBERSHIP_REQUEST_DECLINED]:
      "Membership Request Declined",
  };

export function formatNotificationEventLabel(eventType: string): string {
  return (
    NOTIFICATION_EVENT_LABELS[eventType as NotificationEventTypeValue] ??
    eventType.replace(/_/g, " ")
  );
}

export function formatNotificationMessage(input: {
  eventType: NotificationEventTypeValue | string;
  actorName: string;
  memberName: string;
  title?: string | null;
  message?: string | null;
}): string {
  if (input.message?.trim()) {
    return input.message.trim();
  }

  const eventType = input.eventType as NotificationEventTypeValue;
  const label = formatNotificationEventLabel(input.eventType).toLowerCase();

  if (eventType === NotificationEventType.PROFILE_PHOTO_CHANGED) {
    return `${input.actorName} updated their profile photo`;
  }

  if (eventType === NotificationEventType.RECEIPT_GENERATED) {
    return `Receipt generated for ${input.memberName}`;
  }

  if (eventType === NotificationEventType.RECEIPT_DOWNLOADED) {
    return `${input.actorName} downloaded a receipt`;
  }

  if (input.title?.trim()) {
    return input.title.trim();
  }

  return `${input.actorName} ${label}`;
}

export function formatNotificationTitle(input: {
  eventType: string;
  title?: string | null;
}): string {
  if (input.title?.trim()) return input.title.trim();
  return formatNotificationEventLabel(input.eventType);
}

export function buildClaimActionUrl(claimId: string): string {
  return `/portal/claims/${claimId}`;
}

export function buildContributionActionUrl(contributionId?: string | null): string {
  if (contributionId) {
    return `/portal/contributions?highlight=${encodeURIComponent(contributionId)}`;
  }
  return "/portal/contributions";
}

export function buildPaymentActionUrl(): string {
  return "/payments";
}

export function buildAnnouncementActionUrl(announcementId: string): string {
  return `/portal/announcements?id=${encodeURIComponent(announcementId)}`;
}

export function getNotificationActionLabel(
  eventType: string,
  relatedModule?: string | null,
): string {
  const type = eventType as NotificationEventTypeValue;

  if (
    type === NotificationEventType.CLAIM_SUBMITTED ||
    type === NotificationEventType.CLAIM_RETURNED ||
    type === NotificationEventType.CLAIM_APPROVED ||
    type === NotificationEventType.CLAIM_REJECTED ||
    type === NotificationEventType.CLAIM_SENT_TO_FINANCE ||
    type === NotificationEventType.CLAIM_PAID ||
    relatedModule === NotificationModule.CLAIMS
  ) {
    return "View Claim";
  }

  if (
    type === NotificationEventType.CONTRIBUTION_RECEIVED ||
    relatedModule === NotificationModule.CONTRIBUTIONS
  ) {
    return "View Contribution";
  }

  if (
    type === NotificationEventType.PAYMENT_RECORDED ||
    relatedModule === NotificationModule.PAYMENTS
  ) {
    return "View Payment";
  }

  if (
    type === NotificationEventType.ANNOUNCEMENT_PUBLISHED ||
    relatedModule === NotificationModule.ANNOUNCEMENTS
  ) {
    return "View Announcement";
  }

  if (
    type === NotificationEventType.MEMBERSHIP_REQUEST_SUBMITTED ||
    type === NotificationEventType.MEMBERSHIP_REQUEST_APPROVED ||
    type === NotificationEventType.MEMBERSHIP_REQUEST_DECLINED
  ) {
    return type === NotificationEventType.MEMBERSHIP_REQUEST_APPROVED
      ? "Activate Account"
      : "View Requests";
  }

  if (relatedModule === NotificationModule.PROFILE) {
    return "View Member";
  }

  if (relatedModule === NotificationModule.RECEIPTS) {
    return "View Receipts";
  }

  return "View details";
}

export function buildMemberClaimNotification(input: {
  eventType:
    | typeof NotificationEventType.CLAIM_SUBMITTED
    | typeof NotificationEventType.CLAIM_RETURNED
    | typeof NotificationEventType.CLAIM_APPROVED
    | typeof NotificationEventType.CLAIM_REJECTED
    | typeof NotificationEventType.CLAIM_SENT_TO_FINANCE
    | typeof NotificationEventType.CLAIM_PAID;
  claimId: string;
  claimNumber: string;
  memberId: string;
  memberName: string;
  serviceNumber: string;
  actorId: string;
  actorName: string;
  extraMessage?: string | null;
}): EmitNotificationInput {
  const title = NOTIFICATION_EVENT_LABELS[input.eventType];
  const base = `Claim ${input.claimNumber}: ${title}.`;
  const message = input.extraMessage?.trim()
    ? `${base} ${input.extraMessage.trim()}`
    : base;

  return {
    eventType: input.eventType,
    audience: NotificationAudience.MEMBER,
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    actorId: input.actorId,
    actorName: input.actorName,
    title,
    message,
    relatedModule: NotificationModule.CLAIMS,
    relatedRecordId: input.claimId,
    actionUrl: buildClaimActionUrl(input.claimId),
    channels: [NotificationChannel.IN_APP],
    metadata: {
      claimNumber: input.claimNumber,
    },
  };
}
