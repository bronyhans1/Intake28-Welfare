import { z } from "zod";

/** Treat blank .env placeholders as unset so optional integration keys do not block startup. */
export function emptyToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export const optionalEnvString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);

export const optionalEnvEmail = z.preprocess(
  emptyToUndefined,
  z.string().email().optional(),
);
