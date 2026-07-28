import { describe, expect, it } from "vitest";
import {
  createWelfareSupportSchema,
  updateWelfareSupportSchema,
  welfareSupportListQuerySchema,
} from "@/lib/validators/welfare-support";
import { WelfareSupportType } from "@/types/enums";

const validCreate = {
  memberId: "uid123",
  memberName: "John Doe",
  serviceNumber: "IS/13984",
  supportType: WelfareSupportType.FUNERAL,
  amount: 500,
  description: "Funeral support for member",
};

describe("createWelfareSupportSchema", () => {
  it("accepts valid input", () => {
    const result = createWelfareSupportSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = createWelfareSupportSchema.safeParse({ ...validCreate, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createWelfareSupportSchema.safeParse({ ...validCreate, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("accepts decimal amounts", () => {
    const result = createWelfareSupportSchema.safeParse({ ...validCreate, amount: 500.75 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(500.75);
  });

  it("rejects non-numeric amount", () => {
    const result = createWelfareSupportSchema.safeParse({
      ...validCreate,
      amount: "GHS 500",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = createWelfareSupportSchema.safeParse({
      ...validCreate,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty memberId", () => {
    const result = createWelfareSupportSchema.safeParse({ ...validCreate, memberId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid support type", () => {
    const result = createWelfareSupportSchema.safeParse({
      ...validCreate,
      supportType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid support types", () => {
    for (const type of Object.values(WelfareSupportType)) {
      const result = createWelfareSupportSchema.safeParse({ ...validCreate, supportType: type });
      expect(result.success, `Expected success for type: ${type}`).toBe(true);
    }
  });

  it("stores amount as a raw number (no currency symbols)", () => {
    const result = createWelfareSupportSchema.safeParse({ ...validCreate, amount: 1250.75 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.amount).toBe("number");
      expect(result.data.amount).toBe(1250.75);
    }
  });
});

describe("updateWelfareSupportSchema", () => {
  const validUpdate = {
    supportType: WelfareSupportType.MEDICAL,
    amount: 750,
    description: "Updated medical support",
  };

  it("accepts valid input", () => {
    const result = updateWelfareSupportSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("rejects amount of 0", () => {
    const result = updateWelfareSupportSchema.safeParse({ ...validUpdate, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = updateWelfareSupportSchema.safeParse({ ...validUpdate, description: "" });
    expect(result.success).toBe(false);
  });
});

describe("welfareSupportListQuerySchema", () => {
  it("applies defaults", () => {
    const result = welfareSupportListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it("accepts valid support type filter", () => {
    const result = welfareSupportListQuerySchema.safeParse({
      supportType: WelfareSupportType.EDUCATION,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid support type filter", () => {
    const result = welfareSupportListQuerySchema.safeParse({ supportType: "unknown" });
    expect(result.success).toBe(false);
  });

  it("accepts memberId filter for future member queries", () => {
    const result = welfareSupportListQuerySchema.safeParse({ memberId: "uid123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memberId).toBe("uid123");
  });

  it("accepts supportYear and supportMonth filters", () => {
    const result = welfareSupportListQuerySchema.safeParse({
      supportYear: 2026,
      supportMonth: 6,
    });
    expect(result.success).toBe(true);
  });
});
