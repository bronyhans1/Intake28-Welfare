import { describe, expect, it, vi, afterEach } from "vitest";
import {
  claimFormFieldElementId,
  focusClaimFormField,
  getFirstInvalidClaimFormField,
  mapClaimFormFieldErrors,
} from "@/lib/claims/claim-form-validation";
import {
  createClaimDraftSchema,
  updateClaimRevisionSchema,
} from "@/lib/validators/claims";

describe("mapClaimFormFieldErrors", () => {
  it("maps the first message per field", () => {
    expect(
      mapClaimFormFieldErrors({
        title: ["Title is required"],
        description: ["Description is required", "too long"],
      }),
    ).toEqual({
      title: "Title is required",
      description: "Description is required",
    });
  });

  it("returns an empty object when there are no field errors", () => {
    expect(mapClaimFormFieldErrors(undefined)).toEqual({});
    expect(mapClaimFormFieldErrors({})).toEqual({});
  });
});

describe("getFirstInvalidClaimFormField", () => {
  it("returns fields in form order so focus lands on the first invalid control", () => {
    expect(
      getFirstInvalidClaimFormField({
        description: "Description is required",
        title: "Title is required",
      }),
    ).toBe("title");
  });

  it("maps attachment URL errors onto the attachment control", () => {
    expect(claimFormFieldElementId("attachmentUrl")).toBe("attachment");
    expect(
      getFirstInvalidClaimFormField({
        attachmentUrl: "Attachment URL is invalid",
      }),
    ).toBe("attachment");
  });
});

describe("focusClaimFormField", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("focuses and scrolls the target field into view", () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn().mockReturnValue({
      focus,
      scrollIntoView,
    });
    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    vi.stubGlobal("document", { getElementById });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("window", { requestAnimationFrame: raf });

    focusClaimFormField("description");

    expect(raf).toHaveBeenCalled();
    expect(getElementById).toHaveBeenCalledWith("description");
    expect(focus).toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });
});

describe("createClaimDraftSchema — draft vs optional fields", () => {
  const base = {
    claimTypeCode: "child_birth",
    title: "Newborn support",
    description: "Requesting welfare support for childbirth.",
  };

  it("A: rejects an empty required description with a field-level message", () => {
    const parsed = createClaimDraftSchema.safeParse({
      ...base,
      description: "   ",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.description?.[0]).toBe(
      "Description is required",
    );
  });

  it("B: accepts a filled description", () => {
    const parsed = createClaimDraftSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("C: allows empty optional attachment and WhatsApp evidence", () => {
    const parsed = createClaimDraftSchema.safeParse({
      ...base,
      incidentDate: null,
      whatsappEvidenceNote: null,
      attachmentUrl: null,
      attachmentPath: null,
      attachmentFileName: null,
      attachmentContentType: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("D: allows saving a draft without an incident date", () => {
    const parsed = createClaimDraftSchema.safeParse({
      ...base,
      claimTypeCode: "medical_support",
      incidentDate: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.incidentDate).toBeNull();
    }
  });

  it("H: accepts a valid Child Birth draft payload", () => {
    const parsed = createClaimDraftSchema.safeParse({
      claimTypeCode: "child_birth",
      title: "Child birth claim",
      description: "Support for childbirth expenses.",
      incidentDate: "2026-08-01",
      whatsappEvidenceNote: "Sent photos via WhatsApp.",
    });
    expect(parsed.success).toBe(true);
  });

  it("I: accepts another configured claim type (medical_support)", () => {
    const parsed = createClaimDraftSchema.safeParse({
      claimTypeCode: "medical_support",
      title: "Clinic visit",
      description: "Outpatient treatment costs.",
      incidentDate: "2026-07-15",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const parsed = createClaimDraftSchema.safeParse({
      ...base,
      title: "",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.title?.[0]).toBe(
      "Title is required",
    );
  });
});

describe("updateClaimRevisionSchema — submit/revision rules", () => {
  it("E: requires incident date for revision/resubmit payloads", () => {
    const parsed = updateClaimRevisionSchema.safeParse({
      title: "Title",
      description: "Description",
      incidentDate: "",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.incidentDate?.[0]).toMatch(
      /Incident date is required/i,
    );
  });

  it("J: accepts a complete revision payload with empty optional fields", () => {
    const parsed = updateClaimRevisionSchema.safeParse({
      title: "Revised title",
      description: "Revised description with more detail.",
      incidentDate: "2026-08-01",
      whatsappEvidenceNote: null,
      attachmentUrl: null,
    });
    expect(parsed.success).toBe(true);
  });
});
