import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAdd,
  mockCollection,
  mockGetAdminDb,
  mockIsFirebaseAdminConfigured,
} = vi.hoisted(() => {
  const mockAdd = vi.fn();
  const mockCollection = vi.fn(() => ({ add: mockAdd }));
  const mockGetAdminDb = vi.fn(() => ({ collection: mockCollection }));
  const mockIsFirebaseAdminConfigured = vi.fn(() => true);
  return {
    mockAdd,
    mockCollection,
    mockGetAdminDb,
    mockIsFirebaseAdminConfigured,
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
  isFirebaseAdminConfigured: () => mockIsFirebaseAdminConfigured(),
}));

import { FieldValue } from "firebase-admin/firestore";
import {
  captureHubtelDiagnostic,
  isHubtelDiagnosticCaptureEnabled,
  resolveHubtelDiagnosticCaptureSessionId,
  sanitizeHubtelCaptureForSupport,
} from "./diagnostic-capture";

describe("hubtel diagnostic capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdd.mockResolvedValue({ id: "doc1" });
    mockCollection.mockImplementation(() => ({ add: mockAdd }));
    mockGetAdminDb.mockImplementation(() => ({ collection: mockCollection }));
    mockIsFirebaseAdminConfigured.mockReturnValue(true);
    vi.stubEnv("HUBTEL_DIAGNOSTIC_CAPTURE", "true");
    vi.stubEnv("HUBTEL_DIAGNOSTIC_CAPTURE_SESSION", "test-session");
    process.env.HUBTEL_DIAGNOSTIC_CAPTURE = "true";
    process.env.HUBTEL_DIAGNOSTIC_CAPTURE_SESSION = "test-session";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.HUBTEL_DIAGNOSTIC_CAPTURE;
    delete process.env.HUBTEL_DIAGNOSTIC_CAPTURE_SESSION;
  });

  it("is enabled only when HUBTEL_DIAGNOSTIC_CAPTURE is exactly true", () => {
    process.env.HUBTEL_DIAGNOSTIC_CAPTURE = "true";
    expect(isHubtelDiagnosticCaptureEnabled()).toBe(true);

    for (const value of ["false", "1", "TRUE", ""] as const) {
      process.env.HUBTEL_DIAGNOSTIC_CAPTURE = value;
      expect(isHubtelDiagnosticCaptureEnabled()).toBe(false);
    }

    delete process.env.HUBTEL_DIAGNOSTIC_CAPTURE;
    expect(isHubtelDiagnosticCaptureEnabled()).toBe(false);
  });

  it("resolves an explicit capture session id", () => {
    process.env.HUBTEL_DIAGNOSTIC_CAPTURE_SESSION = "hubtel-support-uat";
    expect(resolveHubtelDiagnosticCaptureSessionId()).toBe("hubtel-support-uat");
  });

  it("writes callback captures with exact body text and parsed JSON", async () => {
    const body = {
      status: "Paid",
      data: { clientReference: "GIS-20261105-ABC123" },
    };

    await captureHubtelDiagnostic({
      captureType: "callback_post",
      source: "callback_route",
      clientReference: "GIS-20261105-ABC123",
      rawText: JSON.stringify(body),
      rawJson: body,
      httpStatus: null,
    });

    expect(mockCollection).toHaveBeenCalledWith("hubtel_diagnostic_captures");
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const written = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(written).toMatchObject({
      captureType: "callback_post",
      source: "callback_route",
      clientReference: "GIS-20261105-ABC123",
      rawText: JSON.stringify(body),
      rawJson: body,
      httpStatus: null,
      captureSessionId: "test-session",
    });
    expect(written.capturedAt).toBeInstanceOf(FieldValue);
  });

  it("parses rawText into rawJson for RMSC captures when rawJson is null", async () => {
    const payload = { responseCode: "0000", data: [{ status: "Failed" }] };

    await captureHubtelDiagnostic({
      captureType: "rmsc_status",
      source: "hubtel_status",
      clientReference: "GIS-20261105-FAIL01",
      rawText: JSON.stringify(payload),
      rawJson: null,
      httpStatus: 200,
    });

    const written = mockAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(written.rawJson).toEqual(payload);
    expect(written.httpStatus).toBe(200);
  });

  it("does not write when the flag is disabled or absent", async () => {
    process.env.HUBTEL_DIAGNOSTIC_CAPTURE = "false";
    await captureHubtelDiagnostic({
      captureType: "rmsc_status",
      source: "hubtel_status",
      clientReference: "GIS-1",
      rawText: "{}",
      rawJson: {},
      httpStatus: 200,
    });
    expect(mockAdd).not.toHaveBeenCalled();

    delete process.env.HUBTEL_DIAGNOSTIC_CAPTURE;
    await captureHubtelDiagnostic({
      captureType: "callback_post",
      source: "callback_route",
      clientReference: "GIS-1",
      rawText: "{}",
      rawJson: {},
      httpStatus: null,
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("swallows Firestore write failures", async () => {
    mockAdd.mockRejectedValue(new Error("firestore unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      captureHubtelDiagnostic({
        captureType: "rmsc_status",
        source: "hubtel_status",
        clientReference: "GIS-1",
        rawText: '{"status":"Paid"}',
        rawJson: null,
        httpStatus: 200,
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("redacts phones and secrets for Support export", () => {
    const sanitized = sanitizeHubtelCaptureForSupport({
      customerMobileNumber: "0241234567",
      nested: { apiKey: "secret-value", phoneNumber: "233241234567" },
      rawText: "Authorization: Basic abcdefgh",
    }) as Record<string, unknown>;

    expect(sanitized.customerMobileNumber).toBe("02***67");
    expect((sanitized.nested as Record<string, unknown>).apiKey).toBe("***");
    expect(String(sanitized.rawText)).toContain("Basic ***");
  });
});
