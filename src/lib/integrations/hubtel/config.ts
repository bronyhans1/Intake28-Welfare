import { z } from "zod";
import { emptyToUndefined } from "@/config/env-helpers";

const hubtelEnvSchema = z.object({
  HUBTEL_CLIENT_ID: z.string().min(1),
  HUBTEL_CLIENT_SECRET: z.string().min(1),
  HUBTEL_SENDER_ID: z.string().min(1),
});

export type HubtelConfig = z.infer<typeof hubtelEnvSchema>;

export class HubtelConfigurationError extends Error {
  constructor(message = "Hubtel SMS is not configured.") {
    super(message);
    this.name = "HubtelConfigurationError";
  }
}

export function isHubtelConfigured(): boolean {
  return Boolean(
    process.env.HUBTEL_CLIENT_ID?.trim() &&
      process.env.HUBTEL_CLIENT_SECRET?.trim() &&
      process.env.HUBTEL_SENDER_ID?.trim(),
  );
}

/** Validates Hubtel credentials only when SMS functionality is invoked. */
export function getHubtelConfig(): HubtelConfig {
  const parsed = hubtelEnvSchema.safeParse({
    HUBTEL_CLIENT_ID: emptyToUndefined(process.env.HUBTEL_CLIENT_ID),
    HUBTEL_CLIENT_SECRET: emptyToUndefined(process.env.HUBTEL_CLIENT_SECRET),
    HUBTEL_SENDER_ID: emptyToUndefined(process.env.HUBTEL_SENDER_ID),
  });

  if (!parsed.success) {
    throw new HubtelConfigurationError();
  }

  return parsed.data;
}
