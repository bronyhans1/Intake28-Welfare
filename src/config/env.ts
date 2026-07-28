import { z } from "zod";
import { getFirebaseWebConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import { isValidServiceNumberSuffix } from "@/lib/utils/service-number";
import { optionalEnvEmail, optionalEnvString } from "@/config/env-helpers";

const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: optionalEnvString,
  FIREBASE_CLIENT_EMAIL: optionalEnvEmail,
  FIREBASE_PRIVATE_KEY: optionalEnvString,
  ACTIVATION_SESSION_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(32).optional(),
  ),
  PAYSTACK_SECRET_KEY: optionalEnvString,
  PAYMENT_EMAIL_DOMAIN: optionalEnvString,
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: optionalEnvString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema> & {
  firebase: ReturnType<typeof getFirebaseWebConfig>;
};

function getClientEnv(): ClientEnv {
  const base = clientEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  });

  return {
    ...base,
    firebase: getFirebaseWebConfig(),
  };
}

function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    ACTIVATION_SESSION_SECRET: process.env.ACTIVATION_SESSION_SECRET,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYMENT_EMAIL_DOMAIN: process.env.PAYMENT_EMAIL_DOMAIN,
  });
}

export const env = {
  client: getClientEnv,
  server: getServerEnv,
  isFirebaseConfigured,
};

export const serviceNumberSuffixSchema = z
  .string()
  .min(1, "Service number is required")
  .refine(isValidServiceNumberSuffix, {
    message: "Service number must contain digits only",
  });

export const phoneNumberSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^0\d{9}$/, "Enter a valid Ghana phone number (e.g. 024XXXXXXX)");
