import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVATION_SESSION_MAX_AGE_SECONDS } from "@/lib/constants/activation";
import type { ActivationContext, ActivationStep } from "@/types/activation";

const COOKIE_NAME = "gis_activation_context";

interface SealedActivationContext extends ActivationContext {
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

function seal(value: SealedActivationContext): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function unseal(token: string): SealedActivationContext | null {
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
    ) as SealedActivationContext;
  } catch {
    return null;
  }
}

function isExpired(createdAt: number): boolean {
  return Date.now() - createdAt > ACTIVATION_SESSION_MAX_AGE_SECONDS * 1000;
}

async function writeActivationCookie(context: ActivationContext): Promise<void> {
  const token = seal({ ...context, createdAt: Date.now() });
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/activate-account",
    maxAge: ACTIVATION_SESSION_MAX_AGE_SECONDS,
  });
}

export async function setActivationContext(
  context: Omit<ActivationContext, "step"> & { step?: ActivationStep },
): Promise<void> {
  await writeActivationCookie({
    ...context,
    step: context.step ?? "otp",
  });
}

export async function updateActivationContext(
  updates: Partial<ActivationContext>,
): Promise<void> {
  const current = await getActivationContext();
  if (!current) {
    throw new Error("No active activation session.");
  }

  await writeActivationCookie({ ...current, ...updates });
}

export async function getActivationContext(): Promise<ActivationContext | null> {
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

export async function requireActivationContext(
  requiredStep?: ActivationStep,
): Promise<ActivationContext> {
  const context = await getActivationContext();

  if (!context) {
    redirect("/activate-account");
  }

  if (requiredStep === "otp" && context.step !== "otp") {
    redirect(
      context.step === "password"
        ? "/activate-account/password"
        : "/activate-account",
    );
  }

  if (requiredStep === "password" && context.step !== "password") {
    redirect(
      context.step === "otp"
        ? "/activate-account/verify"
        : "/activate-account",
    );
  }

  return context;
}

export async function clearActivationContext(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
