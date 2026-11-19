import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";

/**
 * Temporary Hubtel Support diagnostic capture (remove after Support submission).
 *
 * Enable:  HUBTEL_DIAGNOSTIC_CAPTURE=true
 * Disable: unset the variable, or set any value other than exactly "true"
 * Session: optional HUBTEL_DIAGNOSTIC_CAPTURE_SESSION (defaults to UTC date)
 *
 * Storage: Admin SDK → hubtel_diagnostic_captures only (no public API).
 * Cleanup:
 *  1. Export docs for the captureSessionId.
 *  2. Sanitize via sanitizeHubtelCaptureForSupport before sharing.
 *  3. Delete the session docs (or the whole collection) in Firebase Console / Admin.
 *  4. Set HUBTEL_DIAGNOSTIC_CAPTURE off and remove this module + call sites.
 */

export type HubtelDiagnosticCaptureType = "callback_post" | "rmsc_status";

export type HubtelDiagnosticCaptureSource =
  | "callback_route"
  | "hubtel_status";

export interface HubtelDiagnosticCaptureInput {
  captureType: HubtelDiagnosticCaptureType;
  source: HubtelDiagnosticCaptureSource;
  clientReference: string | null;
  /** Exact response/request text when available (preferred for RMSC). */
  rawText: string | null;
  /** Parsed JSON body when available. */
  rawJson: unknown;
  httpStatus: number | null;
}

/** Fail-closed: capture runs only when the flag is exactly `"true"`. */
export function isHubtelDiagnosticCaptureEnabled(): boolean {
  return process.env.HUBTEL_DIAGNOSTIC_CAPTURE === "true";
}

export function resolveHubtelDiagnosticCaptureSessionId(): string {
  const configured = process.env.HUBTEL_DIAGNOSTIC_CAPTURE_SESSION?.trim();
  if (configured) {
    return configured.slice(0, 120);
  }
  return `auto-${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Redact common PII / secrets before sharing captures with Hubtel Support.
 * Does not mutate the stored Firestore document.
 */
export function sanitizeHubtelCaptureForSupport(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeHubtelCaptureForSupport(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (isSensitiveKey(key)) {
        out[key] = "***";
        continue;
      }
      out[key] = sanitizeHubtelCaptureForSupport(nested);
    }
    return out;
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  return /authorization|api[_-]?key|client[_-]?secret|password|basic/i.test(
    key,
  );
}

function redactSensitiveText(text: string): string {
  return text
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic ***")
    .replace(
      /"(authorization|api[_-]?key|client[_-]?secret|password)"\s*:\s*"[^"]*"/gi,
      '"$1":"***"',
    )
    .replace(
      /("(?:customer(?:MobileNumber|PhoneNumber)|mobileNumber|phoneNumber|msisdn|email)"\s*:\s*")([^"]+)(")/gi,
      (_, prefix: string, value: string, suffix: string) =>
        `${prefix}${maskValue(value)}${suffix}`,
    )
    .replace(/\b0\d{9}\b/g, (match) => maskValue(match))
    .replace(/\b233\d{9}\b/g, (match) => maskValue(match));
}

function maskValue(value: string): string {
  if (value.length <= 4) {
    return "***";
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

/**
 * Best-effort diagnostic write. Never throws to callers — payment flow must continue.
 */
export async function captureHubtelDiagnostic(
  input: HubtelDiagnosticCaptureInput,
): Promise<void> {
  try {
    if (!isHubtelDiagnosticCaptureEnabled()) {
      return;
    }
    if (!isFirebaseAdminConfigured()) {
      return;
    }

    const captureSessionId = resolveHubtelDiagnosticCaptureSessionId();
    const rawJson = resolveRawJson(input.rawJson, input.rawText);
    const document = sanitizeFirestoreData({
      captureType: input.captureType,
      source: input.source,
      clientReference: input.clientReference,
      rawText: input.rawText,
      rawJson,
      httpStatus: input.httpStatus,
      captureSessionId,
      capturedAt: FieldValue.serverTimestamp(),
    });

    warnInvalidFirestorePayload("hubtel_diagnostic_capture", document);

    await getAdminDb()
      .collection(COLLECTIONS.HUBTEL_DIAGNOSTIC_CAPTURES)
      .add(document);
  } catch (error) {
    console.error("[hubtel:diagnostic-capture] write failed", {
      captureType: input.captureType,
      source: input.source,
      clientReference: input.clientReference,
      // Do not log raw bodies (may contain customer PII).
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

function resolveRawJson(rawJson: unknown, rawText: string | null): unknown {
  if (rawJson !== undefined && rawJson !== null) {
    return rawJson;
  }
  if (!rawText) {
    return null;
  }
  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}
