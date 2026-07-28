import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canArchiveAnnouncements,
  canManageAnnouncements,
  canViewAnnouncements,
  createAnnouncement,
  getPublishedAnnouncementCount,
  getVisibleAnnouncementCountForUser,
  updateAnnouncement,
} from "@/lib/announcements/repository";
import {
  filterVisibleAnnouncements,
  isAnnouncementPublishedAndNotExpired,
  isAnnouncementVisibleToViewer,
} from "@/lib/announcements/visibility";
import { AnnouncementAuditAction } from "@/lib/announcements/audit";
import {
  formatAuditActionLabel,
  formatAuditDescription,
  formatAuditEntityLabel,
} from "@/lib/audit/labels";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  AnnouncementAudience,
  AnnouncementStatus,
  UserRole,
  UserStatus,
} from "@/types/enums";
import type { SerializedAnnouncement } from "@/types/announcement";

const mockCreateAuditLog = vi.fn();
const mockGetDefaulters = vi.fn();
const mockGetMemberById = vi.fn();
const mockGetDefaultAnnouncementExpiryDays = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/finance/defaulters", () => ({
  getDefaulters: () => mockGetDefaulters(),
}));

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getDefaultAnnouncementExpiryDays: () => mockGetDefaultAnnouncementExpiryDays(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

const actor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/00002",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

function makeAnnouncementFirestoreDoc(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    data: () => ({
      title: "Test Announcement",
      message: "Test message",
      audience: AnnouncementAudience.ALL_MEMBERS,
      status: AnnouncementStatus.PUBLISHED,
      publishedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
      expiresAt: null,
      createdBy: "admin-1",
      createdByName: "Admin User",
      updatedBy: "admin-1",
      updatedByName: "Admin User",
      createdAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
      updatedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
      ...overrides,
    }),
  };
}

const baseAnnouncement: SerializedAnnouncement = {
  id: "a1",
  title: "Monthly Dues Reminder",
  message: "Please pay your dues.",
  audience: AnnouncementAudience.ALL_MEMBERS,
  status: AnnouncementStatus.PUBLISHED,
  publishedAt: "2026-06-01T00:00:00.000Z",
  expiresAt: null,
  createdBy: "admin-1",
  createdByName: "Admin User",
  updatedBy: "admin-1",
  updatedByName: "Admin User",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("announcement permissions", () => {
  it("allows admin and treasurer to view and manage announcements", () => {
    expect(canViewAnnouncements(UserRole.ADMIN)).toBe(true);
    expect(canViewAnnouncements(UserRole.TREASURER)).toBe(true);
    expect(canManageAnnouncements(UserRole.ADMIN)).toBe(true);
    expect(canManageAnnouncements(UserRole.TREASURER)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_ANNOUNCEMENTS)).toBe(true);
    expect(hasPermission(UserRole.MEMBER, Permission.MANAGE_ANNOUNCEMENTS)).toBe(false);
  });

  it("allows only admins to archive announcements", () => {
    expect(canArchiveAnnouncements(UserRole.ADMIN)).toBe(true);
    expect(canArchiveAnnouncements(UserRole.TREASURER)).toBe(false);
  });
});

describe("announcement visibility rules", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("shows only published and non-expired announcements", () => {
    expect(
      isAnnouncementPublishedAndNotExpired(
        { status: AnnouncementStatus.PUBLISHED, expiresAt: null },
        now,
      ),
    ).toBe(true);

    expect(
      isAnnouncementPublishedAndNotExpired(
        { status: AnnouncementStatus.DRAFT, expiresAt: null },
        now,
      ),
    ).toBe(false);

    expect(
      isAnnouncementPublishedAndNotExpired(
        {
          status: AnnouncementStatus.PUBLISHED,
          expiresAt: "2026-06-10T00:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("filters announcements by audience", () => {
    const announcements: SerializedAnnouncement[] = [
      { ...baseAnnouncement, id: "all", audience: AnnouncementAudience.ALL_MEMBERS },
      {
        ...baseAnnouncement,
        id: "active",
        audience: AnnouncementAudience.ACTIVE_MEMBERS,
      },
      {
        ...baseAnnouncement,
        id: "defaulters",
        audience: AnnouncementAudience.DEFAULTERS,
      },
      {
        ...baseAnnouncement,
        id: "treasurers",
        audience: AnnouncementAudience.TREASURERS,
      },
    ];

    const visible = filterVisibleAnnouncements(
      announcements,
      {
        userId: "m1",
        role: UserRole.MEMBER,
        status: UserStatus.ACTIVE,
        isDefaulter: true,
      },
      now,
    );

    expect(visible.map((item) => item.id)).toEqual(["all", "active", "defaulters"]);
    expect(
      isAnnouncementVisibleToViewer(
        { ...baseAnnouncement, audience: AnnouncementAudience.ADMINS },
        {
          userId: "m1",
          role: UserRole.MEMBER,
          status: UserStatus.ACTIVE,
          isDefaulter: false,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("announcements repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({
      doc: mockDoc,
      orderBy: mockOrderBy,
    });
    mockDoc.mockReturnValue({ id: "announcement-1", set: mockSet, get: mockGet, update: mockUpdate });
    mockOrderBy.mockReturnValue({ get: mockGet });
    mockGet.mockReset();
    mockGet.mockResolvedValue({ docs: [], exists: false });
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockGetDefaulters.mockResolvedValue([]);
    mockGetMemberById.mockResolvedValue({
      id: "member-1",
      status: UserStatus.ACTIVE,
    });
    mockGetDefaultAnnouncementExpiryDays.mockResolvedValue(30);
  });

  it("creates draft announcements and logs announcement_created", async () => {
    await createAnnouncement(
      {
        title: "Draft Notice",
        message: "Pending review",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.DRAFT,
      },
      actor,
    );

    expect(mockSet).toHaveBeenCalled();
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AnnouncementAuditAction.ANNOUNCEMENT_CREATED,
        entityType: "announcement",
      }),
    );
  });

  it("publishes immediately when publishNow is selected", async () => {
    await createAnnouncement(
      {
        title: "Published Notice",
        message: "Live now",
        audience: AnnouncementAudience.ACTIVE_MEMBERS,
        status: AnnouncementStatus.DRAFT,
        publishNow: true,
      },
      actor,
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED,
      }),
    );
  });

  it("logs publish and archive events on update", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: "announcement-1",
      data: () => ({
        title: "Old Title",
        message: "Old message",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.DRAFT,
        createdBy: "admin-1",
        createdByName: "Admin User",
        updatedBy: "admin-1",
        updatedByName: "Admin User",
      }),
    });

    await updateAnnouncement(
      "announcement-1",
      {
        title: "Published Title",
        message: "Updated message",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.PUBLISHED,
      },
      actor,
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AnnouncementAuditAction.ANNOUNCEMENT_UPDATED,
      }),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED,
      }),
    );

    mockGet.mockResolvedValueOnce({
      exists: true,
      id: "announcement-1",
      data: () => ({
        title: "Published Title",
        message: "Updated message",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.PUBLISHED,
        publishedAt: { toDate: () => new Date("2026-06-01T00:00:00.000Z") },
        createdBy: "admin-1",
        createdByName: "Admin User",
        updatedBy: "admin-1",
        updatedByName: "Admin User",
      }),
    });

    await updateAnnouncement(
      "announcement-1",
      {
        title: "Published Title",
        message: "Updated message",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.ARCHIVED,
      },
      actor,
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AnnouncementAuditAction.ANNOUNCEMENT_ARCHIVED,
      }),
    );
  });

  it("prevents treasurers from archiving announcements", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: "announcement-1",
      data: () => ({
        title: "Published Title",
        message: "Updated message",
        audience: AnnouncementAudience.ALL_MEMBERS,
        status: AnnouncementStatus.PUBLISHED,
        createdBy: "admin-1",
        createdByName: "Admin User",
        updatedBy: "admin-1",
        updatedByName: "Admin User",
      }),
    });

    await expect(
      updateAnnouncement(
        "announcement-1",
        {
          title: "Published Title",
          message: "Updated message",
          audience: AnnouncementAudience.ALL_MEMBERS,
          status: AnnouncementStatus.ARCHIVED,
        },
        { ...actor, role: UserRole.TREASURER },
      ),
    ).rejects.toThrow("You do not have permission to archive announcements.");
  });

  it("counts only published announcements for admin dashboard", async () => {
    mockGet.mockResolvedValue({
      docs: [
        makeAnnouncementFirestoreDoc("published-1"),
        makeAnnouncementFirestoreDoc("published-2"),
        makeAnnouncementFirestoreDoc("draft-1", {
          status: AnnouncementStatus.DRAFT,
          publishedAt: null,
        }),
        makeAnnouncementFirestoreDoc("archived-1", {
          status: AnnouncementStatus.ARCHIVED,
        }),
      ],
    });

    await expect(getPublishedAnnouncementCount()).resolves.toBe(2);
  });

  it("counts only visible announcements for members", async () => {
    mockGet.mockResolvedValue({
      docs: [
        makeAnnouncementFirestoreDoc("visible-1"),
        makeAnnouncementFirestoreDoc("visible-2", {
          audience: AnnouncementAudience.ACTIVE_MEMBERS,
        }),
        makeAnnouncementFirestoreDoc("draft-1", {
          status: AnnouncementStatus.DRAFT,
          publishedAt: null,
        }),
        makeAnnouncementFirestoreDoc("expired-1", {
          expiresAt: makeTimestamp("2020-01-01T00:00:00.000Z"),
        }),
        makeAnnouncementFirestoreDoc("admins-only", {
          audience: AnnouncementAudience.ADMINS,
        }),
      ],
    });
    mockGetMemberById.mockResolvedValue({
      id: "member-1",
      status: UserStatus.ACTIVE,
    });

    await expect(getVisibleAnnouncementCountForUser(memberActor)).resolves.toBe(2);
  });
});

describe("announcement audit labels", () => {
  it("formats announcement audit labels and descriptions", () => {
    expect(formatAuditActionLabel(AnnouncementAuditAction.ANNOUNCEMENT_CREATED)).toBe(
      "Announcement created",
    );
    expect(
      formatAuditEntityLabel("announcement", "a1", { title: "Monthly Dues Reminder" }),
    ).toBe("Monthly Dues Reminder");
    expect(
      formatAuditDescription(AnnouncementAuditAction.ANNOUNCEMENT_PUBLISHED, {
        title: "Monthly Dues Reminder",
      }),
    ).toBe('Published announcement "Monthly Dues Reminder"');
  });
});
