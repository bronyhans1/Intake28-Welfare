import type { UpdateProfileFormInput } from "@/lib/validators/profile";
import { normalizeMemberEmail } from "@/lib/members/email";
import { NotificationEventType } from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";
import type { User } from "@/types/user";
import { emitProfileNotificationEvent } from "@/lib/notifications/profile-events";

const PROFILE_NOTIFICATION_FIELDS = {
  email: NotificationEventType.PROFILE_EMAIL_CHANGED,
  rank: NotificationEventType.PROFILE_RANK_CHANGED,
  station: NotificationEventType.PROFILE_STATION_CHANGED,
  nextOfKin: NotificationEventType.PROFILE_NEXT_OF_KIN_CHANGED,
  emergencyContact: NotificationEventType.PROFILE_EMERGENCY_CONTACT_CHANGED,
} as const;

type ProfileNotificationField = keyof typeof PROFILE_NOTIFICATION_FIELDS;

function normalizeComparableValue(
  field: ProfileNotificationField,
  value: unknown,
): string | null {
  if (field === "email") {
    return normalizeMemberEmail(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  return null;
}

export async function emitProfileFieldChangeEvents(
  existing: User,
  input: UpdateProfileFormInput,
  actor: CurrentUser,
): Promise<void> {
  const nextValues: Record<ProfileNotificationField, string | null> = {
    email: normalizeMemberEmail(input.email),
    rank: input.rank.trim() || null,
    station: input.station.trim() || null,
    nextOfKin: input.nextOfKin?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
  };

  const previousValues: Record<ProfileNotificationField, string | null> = {
    email: normalizeMemberEmail(existing.email),
    rank: existing.rank?.trim() || null,
    station: existing.station?.trim() || null,
    nextOfKin: existing.nextOfKin?.trim() || null,
    emergencyContact: existing.emergencyContact?.trim() || null,
  };

  for (const field of Object.keys(PROFILE_NOTIFICATION_FIELDS) as ProfileNotificationField[]) {
    const before = normalizeComparableValue(field, previousValues[field]);
    const after = normalizeComparableValue(field, nextValues[field]);

    if (before === after) {
      continue;
    }

    await emitProfileNotificationEvent({
      memberId: existing.id,
      memberName: existing.fullName,
      serviceNumber: existing.serviceNumber,
      eventType: PROFILE_NOTIFICATION_FIELDS[field],
      actorId: actor.uid,
      actorName: actor.fullName,
      metadata: {
        field,
        before,
        after,
      },
    });
  }
}

export async function emitProfilePhotoChangeEvent(
  existing: User,
  actor: CurrentUser,
  metadata: {
    before: string | null;
    after: string | null;
    action: "uploaded" | "updated" | "removed";
  },
): Promise<void> {
  await emitProfileNotificationEvent({
    memberId: existing.id,
    memberName: existing.fullName,
    serviceNumber: existing.serviceNumber,
    eventType: NotificationEventType.PROFILE_PHOTO_CHANGED,
    actorId: actor.uid,
    actorName: actor.fullName,
    metadata,
  });
}
