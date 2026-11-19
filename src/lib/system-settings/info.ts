import {
  APPLICATION_VERSION_LABEL,
  APP_VERSION,
} from "@/lib/branding/version";

export { APPLICATION_VERSION_LABEL, APP_VERSION };

export const POWERED_BY_LABEL = "Powered by Brony Hans";

export interface SystemInformation {
  versionLabel: string;
  poweredByLabel: string;
}

export function getSystemInformation(): SystemInformation {
  return {
    versionLabel: APPLICATION_VERSION_LABEL,
    poweredByLabel: POWERED_BY_LABEL,
  };
}
