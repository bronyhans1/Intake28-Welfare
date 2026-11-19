import { z } from "zod";
import { AnnouncementAudience, AnnouncementStatus } from "@/types/enums";

const AUDIENCES = [
  AnnouncementAudience.ALL_MEMBERS,
  AnnouncementAudience.ACTIVE_MEMBERS,
  AnnouncementAudience.DEFAULTERS,
  AnnouncementAudience.TREASURERS,
  AnnouncementAudience.ADMINS,
] as const;

const STATUSES = [
  AnnouncementStatus.DRAFT,
  AnnouncementStatus.PUBLISHED,
  AnnouncementStatus.ARCHIVED,
] as const;

export const announcementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  audience: z.enum(AUDIENCES).optional(),
  status: z.enum(STATUSES).optional(),
  publishedFrom: z.string().optional(),
  publishedTo: z.string().optional(),
});

export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
  audience: z.enum(AUDIENCES, { message: "Select a valid audience" }),
  status: z.enum(STATUSES).default(AnnouncementStatus.DRAFT),
  publishNow: z.boolean().optional(),
  expiresAt: z.string().optional().nullable(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
  audience: z.enum(AUDIENCES, { message: "Select a valid audience" }),
  status: z.enum(STATUSES),
  expiresAt: z.string().optional().nullable(),
});

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
