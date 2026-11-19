import type { Timestamp } from "firebase/firestore";
import type { AnnouncementAudience, AnnouncementStatus } from "./enums";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  publishedAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SerializedAnnouncement = Omit<
  Announcement,
  "publishedAt" | "expiresAt" | "createdAt" | "updatedAt"
> & {
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
