import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PASSWORD_RESET_SESSION_MAX_AGE_SECONDS } from "@/lib/constants/password-reset";
import type {
  PasswordResetContext,
  PasswordResetStep,
} from "@/types/password-reset";

const COOKIE_NAME = "gis_password_reset_context";

interface SealedPasswordResetContext extends PasswordResetContext {
  createdAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.ACTIVATION_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "ACTIVATION_SESSION_SECRET must be set with at least 32 characters.",
    );
  }

  return secret;
}

function seal(value: SealedPasswordResetContext): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function unseal(token: string): SealedPasswordResetContext | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SealedPasswordResetContext;
  } catch {
    return null;
  }
}

function isExpired(createdAt: number): boolean {
  return (
    Date.now() - createdAt > PASSWORD_RESET_SESSION_MAX_AGE_SECONDS * 1000
  );
}

async function writePasswordResetCookie(
  context: PasswordResetContext,
): Promise<void> {
  const token = seal({ ...context, createdAt: Date.now() });
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/forgot-password",
    maxAge: PASSWORD_RESET_SESSION_MAX_AGE_SECONDS,
  });
}

export async function setPasswordResetContext(
  context: Omit<PasswordResetContext, "step"> & { step?: PasswordResetStep },
): Promise<void> {
  await writePasswordResetCookie({
    ...context,
    step: context.step ?? "otp",
  });
}

export async function updatePasswordResetContext(
  updates: Partial<PasswordResetContext>,
): Promise<void> {
  const current = await getPasswordResetContext();
  if (!current) {
    throw new Error("No active password reset session.");
  }

  await writePasswordResetCookie({ ...current, ...updates });
}

export async function getPasswordResetContext(): Promise<PasswordResetContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const data = unseal(token);

  if (!data || isExpired(data.createdAt)) {
    return null;
  }

  return {
    userId: data.userId,
    serviceNumber: data.serviceNumber,
    phoneNumber: data.phoneNumber,
    step: data.step,
  };
}

export async function requirePasswordResetContext(
  requiredStep?: PasswordResetStep,
): Promise<PasswordResetContext> {
  const context = await getPasswordResetContext();

  if (!context) {
    redirect("/forgot-password");
  }

  if (requiredStep === "otp" && context.step !== "otp") {
    redirect(
      context.step === "reset"
        ? "/forgot-password/reset"
        : "/forgot-password",
    );
  }

  if (requiredStep === "reset" && context.step !== "reset") {
    redirect(
      context.step === "otp"
        ? "/forgot-password/verify"
        : "/forgot-password",
    );
  }

  return context;
}

export async function clearPasswordResetContext(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
