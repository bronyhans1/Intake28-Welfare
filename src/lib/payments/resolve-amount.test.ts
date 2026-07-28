import { describe, expect, it } from "vitest";
import { PaymentType } from "@/types/enums";
import {
  formatPaymentAmountInput,
  isMonthlyDuesPaymentType,
  resolveInitializePaymentAmount,
  resolveMemberPaymentFormAmount,
} from "@/lib/payments/resolve-amount";

describe("resolveInitializePaymentAmount", () => {
  const configuredAmount = 50;

  it("uses configured monthly dues when submitted amount is 5", () => {
    expect(
      resolveInitializePaymentAmount(
        PaymentType.MONTHLY_DUES,
        5,
        configuredAmount,
      ),
    ).toBe(50);
  });

  it("uses configured monthly dues when submitted amount is 500", () => {
    expect(
      resolveInitializePaymentAmount(
        PaymentType.MONTHLY_DUES,
        500,
        configuredAmount,
      ),
    ).toBe(50);
  });

  it("uses configured monthly dues when no amount is supplied", () => {
    expect(
      resolveInitializePaymentAmount(
        PaymentType.MONTHLY_DUES,
        undefined,
        configuredAmount,
      ),
    ).toBe(50);
  });

  it("multiplies configured monthly dues by selected month count", () => {
    expect(
      resolveInitializePaymentAmount(
        PaymentType.MONTHLY_DUES,
        undefined,
        configuredAmount,
        3,
      ),
    ).toBe(150);
  });

  it("uses submitted amount for special contributions", () => {
    expect(
      resolveInitializePaymentAmount(
        PaymentType.SPECIAL_CONTRIBUTION,
        100,
        configuredAmount,
      ),
    ).toBe(100);
  });

  it("rejects special contributions without an amount", () => {
    expect(() =>
      resolveInitializePaymentAmount(
        PaymentType.SPECIAL_CONTRIBUTION,
        undefined,
        configuredAmount,
      ),
    ).toThrow("Amount must be at least 1.");
  });
});

describe("member payment form amount helpers", () => {
  it("locks monthly dues amount to configured value", () => {
    expect(isMonthlyDuesPaymentType(PaymentType.MONTHLY_DUES)).toBe(true);
    expect(
      resolveMemberPaymentFormAmount(
        PaymentType.MONTHLY_DUES,
        50,
        "5",
      ),
    ).toBe("50");
  });

  it("keeps editable amount for special contributions", () => {
    expect(isMonthlyDuesPaymentType(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      false,
    );
    expect(
      resolveMemberPaymentFormAmount(
        PaymentType.SPECIAL_CONTRIBUTION,
        50,
        "100",
      ),
    ).toBe("100");
  });

  it("restores configured monthly dues when switching payment types", () => {
    expect(
      resolveMemberPaymentFormAmount(
        PaymentType.MONTHLY_DUES,
        50,
        "100",
      ),
    ).toBe("50");
    expect(
      resolveMemberPaymentFormAmount(
        PaymentType.SPECIAL_CONTRIBUTION,
        50,
        "100",
      ),
    ).toBe("100");
  });

  it("formats configured amounts for display", () => {
    expect(formatPaymentAmountInput(50)).toBe("50");
    expect(formatPaymentAmountInput(50.5)).toBe("50.50");
  });
});
