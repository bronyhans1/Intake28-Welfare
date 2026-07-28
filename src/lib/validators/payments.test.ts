import { describe, expect, it } from "vitest";
import { PaymentType } from "@/types/enums";
import { initializePaymentSchema } from "@/lib/validators/payments";

describe("initializePaymentSchema", () => {
  it("requires selected months for monthly dues", () => {
    const result = initializePaymentSchema.safeParse({
      memberId: "member-1",
      paymentType: PaymentType.MONTHLY_DUES,
    });

    expect(result.success).toBe(false);
  });

  it("accepts monthly dues with selected months", () => {
    const result = initializePaymentSchema.safeParse({
      memberId: "member-1",
      paymentType: PaymentType.MONTHLY_DUES,
      selectedMonths: [
        { month: 9, year: 2026 },
        { month: 11, year: 2026 },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selectedMonths).toHaveLength(2);
    }
  });

  it("accepts monthly dues with a submitted amount that validation ignores downstream", () => {
    const result = initializePaymentSchema.safeParse({
      memberId: "member-1",
      paymentType: PaymentType.MONTHLY_DUES,
      amount: 5,
      selectedMonths: [{ month: 6, year: 2026 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5);
    }
  });

  it("requires amount for special contributions", () => {
    const result = initializePaymentSchema.safeParse({
      memberId: "member-1",
      paymentType: PaymentType.SPECIAL_CONTRIBUTION,
    });

    expect(result.success).toBe(false);
  });

  it("accepts special contribution amount", () => {
    const result = initializePaymentSchema.safeParse({
      memberId: "member-1",
      paymentType: PaymentType.SPECIAL_CONTRIBUTION,
      amount: 100,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
    }
  });
});
