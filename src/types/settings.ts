import type { Timestamp } from "firebase/firestore";
import { SettingsCurrency } from "@/types/enums";

/** Stored at system/settings — singleton document for portal configuration */
export interface SystemSettings {
  organizationName: string;
  portalName: string;
  supportEmail: string;
  supportPhone: string;
  monthlyDuesAmount: number;
  currency: SettingsCurrency;
  defaultAnnouncementExpiryDays: number;
  defaulterThresholdMonths: number;
  serviceNumberPrefix: "IS/";
  receiptNumberPrefix: string;
  /** When true and a valid URL is set, members see the WhatsApp community FAB. */
  whatsappCommunityEnabled: boolean;
  /** Official WhatsApp group/community invite URL (HTTPS). */
  whatsappCommunityUrl: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type SystemSettingsData = Omit<SystemSettings, "updatedAt" | "updatedBy">;

export interface SerializedSystemSettings extends SystemSettingsData {
  updatedAt: string | null;
  updatedBy: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsData = {
  organizationName: "GIS Intake 28 Welfare Association",
  portalName: "GIS Intake 28 Welfare Portal",
  supportEmail: "",
  supportPhone: "",
  monthlyDuesAmount: 50,
  currency: SettingsCurrency.GHS,
  defaultAnnouncementExpiryDays: 30,
  defaulterThresholdMonths: 2,
  serviceNumberPrefix: "IS/",
  receiptNumberPrefix: "GIS",
  whatsappCommunityEnabled: false,
  whatsappCommunityUrl: "",
};

export const SETTINGS_SECTIONS = {
  ORGANIZATION: "organization",
  FINANCE: "finance",
  COMMUNICATIONS: "communications",
} as const;

export type SettingsSection =
  (typeof SETTINGS_SECTIONS)[keyof typeof SETTINGS_SECTIONS];
