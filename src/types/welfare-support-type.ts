import type { Timestamp } from "firebase/firestore";

/** Admin-configurable catalog entry for standalone Welfare Support recording. */
export interface WelfareSupportTypeConfig {
  id: string;
  /** Stable identity stored on welfare_support.supportType */
  code: string;
  displayName: string;
  description: string;
  active: boolean;
  sortOrder: number;
  createdById: string;
  createdByName: string;
  updatedById: string;
  updatedByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SerializedWelfareSupportTypeConfig = Omit<
  WelfareSupportTypeConfig,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

/** Lightweight option for recording forms and filters. */
export interface WelfareSupportTypeOption {
  code: string;
  displayName: string;
  active: boolean;
  sortOrder: number;
}
