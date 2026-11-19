import { getDefaulters } from "@/lib/finance/defaulters";
import { isAnnouncementVisibleToViewer } from "@/lib/announcements/visibility";
import { listMembers } from "@/lib/members/repository";
import { notifyAnnouncementPublished } from "@/lib/notifications/announcement-events";
import { NotificationAudience } from "@/lib/notifications/types";
import { UserRole, UserStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { SerializedAnnouncement } from "@/types/announcement";
import type { SerializedMember } from "@/types/user";

async function listAllMembersForFanOut(): Promise<SerializedMember[]> {
  const members: SerializedMember[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await listMembers({ page, pageSize: 50 });
    members.push(...result.members);
    totalPages = result.totalPages;
    page += 1;
  }

  return members;
}

async function listAllDefaulterIds(): Promise<Set<string>> {
  const records = await getDefaulters();
  return new Set(records.map((record) => record.memberId));
}

/**
 * Fan-out published announcement notifications to visible recipients.
 * Uses the unified notification engine (In-App only).
 */
export async function fanOutAnnouncementPublishedNotifications(
  announcement: Pick<
    SerializedAnnouncement,
    "id" | "title" | "audience" | "status" | "expiresAt"
  >,
  actor: CurrentUser,
): Promise<void> {
  const [members, defaulterIds] = await Promise.all([
    listAllMembersForFanOut(),
    listAllDefaulterIds(),
  ]);

  await Promise.all(
    members.map(async (member) => {
      const viewer = {
        userId: member.id,
        role: member.role,
        status: member.status ?? UserStatus.ACTIVE,
        isDefaulter: defaulterIds.has(member.id),
      };

      if (!isAnnouncementVisibleToViewer(announcement, viewer)) {
        return;
      }

      const audience =
        member.role === UserRole.MEMBER
          ? NotificationAudience.MEMBER
          : NotificationAudience.EXECUTIVE;

      await notifyAnnouncementPublished(
        announcement,
        {
          memberId: member.id,
          memberName: member.fullName,
          serviceNumber: member.serviceNumber,
          audience,
        },
        actor,
      );
    }),
  );
}
