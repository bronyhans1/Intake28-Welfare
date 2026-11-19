import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const overviewSource = readFileSync(
  join(process.cwd(), "src/components/admin/reconciliation-overview.tsx"),
  "utf8",
);
const detailSource = readFileSync(
  join(process.cwd(), "src/components/admin/reconciliation-detail-section.tsx"),
  "utf8",
);

describe("reconciliation overview UI collapse behavior", () => {
  it("starts secondary verification sections collapsed by default", () => {
    expect(detailSource).toContain("useState(false)");
    expect(detailSource).toContain('data-default-collapsed="true"');
    expect(detailSource).toContain("View records");
    expect(detailSource).toContain("Hide records");
    expect(detailSource).toContain("aria-expanded={open}");
    expect(detailSource).toContain("aria-controls={panelId}");
  });

  it("wraps verification batches and limitations in collapsible detail sections", () => {
    expect(overviewSource).toContain("ReconciliationDetailSection");
    expect(overviewSource).toContain('sectionId="paystack-batch"');
    expect(overviewSource).toContain('sectionId="hubtel-batch"');
    expect(overviewSource).toContain('sectionId="paystack-limitations"');
    expect(overviewSource).toContain('sectionId="hubtel-limitations"');
    expect(overviewSource).toContain("Paystack Verification Not Completed —");
    expect(overviewSource).toContain("Hubtel Verification Not Completed —");
    expect(overviewSource).toContain("Their final payment outcome is unknown");
  });

  it("keeps confirmed financial discrepancies expanded and recoverable", () => {
    expect(overviewSource).toContain('data-reconciliation-priority="actionable"');
    expect(overviewSource).toContain("Payments Missing Contributions");
    expect(overviewSource).toContain("Unsettled Paystack Successes");
    expect(overviewSource).toContain("Unsettled Hubtel Successes");
    expect(overviewSource).toContain("Paystack Amount Or Currency Differences");
    expect(overviewSource).toContain("Hubtel Amount Or Currency Differences");
    expect(overviewSource).toContain("RecoverUnsettledPaymentButton");
    expect(overviewSource).toContain('providerLabel="Paystack"');
    expect(overviewSource).toContain('providerLabel="Hubtel"');

    const actionableBlocks = overviewSource.split('data-reconciliation-priority="actionable"');
    for (const block of actionableBlocks.slice(1)) {
      const nextPriority = block.indexOf("ReconciliationDetailSection");
      const recoverIdx = block.indexOf("RecoverUnsettledPaymentButton");
      // Actionable cards must not be nested inside detail sections.
      if (block.includes("Unsettled")) {
        expect(recoverIdx).toBeGreaterThan(-1);
        if (nextPriority !== -1) {
          expect(recoverIdx).toBeLessThan(nextPriority);
        }
      }
    }
  });

  it("does not settle or discard records when collapsing secondary details", () => {
    expect(overviewSource).not.toContain("settlePayment");
    expect(overviewSource).not.toContain("deletePayment");
    expect(overviewSource).not.toContain("hubtelFetchTransactionStatus");
    expect(detailSource).not.toContain("settlePayment");
    expect(detailSource).toContain("Collapsible");
    expect(detailSource).toContain("CollapsibleTrigger");
    expect(detailSource).toContain("CollapsibleContent");
  });
});
