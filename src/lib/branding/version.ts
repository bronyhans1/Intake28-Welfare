/**
 * Single source of truth for the GIS Welfare Portal application version.
 * Import APP_VERSION / formatAppVersionLabel everywhere — never hardcode.
 */
export const APP_VERSION = "1.7.0";

export function formatAppVersionLabel(version: string = APP_VERSION): string {
  return `Version ${version}`;
}

export const APPLICATION_VERSION_LABEL = formatAppVersionLabel(APP_VERSION);
