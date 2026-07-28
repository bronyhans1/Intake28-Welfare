export const SettingsAuditAction = {
  SETTINGS_UPDATED: "settings_updated",
} as const;

export type SettingsAuditAction =
  (typeof SettingsAuditAction)[keyof typeof SettingsAuditAction];
