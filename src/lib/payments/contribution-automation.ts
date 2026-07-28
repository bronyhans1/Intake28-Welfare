import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import {
  createAutomatedContribution,
  findPaidMonthlyDuesContribution,
  getContributionByPaymentReference,
  listContributionsByPaymentReference,
} from "@/lib/contributions/repository";
import {
  formatMonthYearLabel,
  getCurrentMonthYear,
  monthYearKey,
  type MonthYear,
} from "@/lib/finance/period";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { resolvePaymentCategory } from "@/lib/payments/payment-category";
import {
  normalizePaymentType,
  resolveContributionTypeFromPayment,
} from "@/lib/payments/payment-type-mapping";
import { ensureReceiptFromPayment } from "@/lib/receipts/service";
import {
  notifyContributionReceived,
  notifyPaymentRecorded,
} from "@/lib/notifications/payment-events";
import { getMonthlyDuesAmount } from "@/lib/system-settings/repository";
import {
  ContributionSource,
  ContributionType,
  PaymentCategory,
  PaymentStatus,
} from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedPayment } from "@/types/payment";

export type PaymentContributionOutcome =
  | "created"
  | "existing"
  | "duplicate_monthly_dues_skipped"
  | "partial";

export interface PaymentContributionResult {
  outcome: PaymentContributionOutcome;
  contribution: SerializedContribution | null;
  contributions?: SerializedContribution[];
}

export class PaymentContributionAutomationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentContributionAutomationError";
  }
}

export { mapPaymentTypeToContributionType, normalizePaymentType } from "@/lib/payments/payment-type-mapping";

async function logPaymentContributionAudit(
  payment: SerializedPayment,
  actor: CurrentUser,
  metadata: {
    outcome: PaymentContributionOutcome;
    contributionId?: string | null;
    contributionType?: string;
    amount?: number;
    month?: number;
    year?: number;
    selectedMonths?: MonthYear[];
    existingContributionId?: string | null;
  },
): Promise<void> {
  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED,
    entityType: "payment",
    entityId: payment.reference,
    ...buildAuditActor(actor),
    metadata: {
      paymentReference: payment.reference,
      paymentId: payment.id,
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber,
      ...metadata,
    },
  });
}

function resolveTargetMonths(payment: SerializedPayment): MonthYear[] {
  const selected = payment.selectedMonths;
  if (Array.isArray(selected) && selected.length > 0) {
    const unique = new Map<string, MonthYear>();
    for (const period of selected) {
      if (
        typeof period?.month !== "number" ||
        typeof period?.year !== "number"
      ) {
        continue;
      }
      unique.set(monthYearKey(period), {
        month: period.month,
        year: period.year,
      });
    }
    return Array.from(unique.values()).sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year,
    );
  }

  return [getCurrentMonthYear()];
}

export async function ensureContributionFromPayment(
  payment: SerializedPayment,
  actor: CurrentUser,
): Promise<PaymentContributionResult> {
  if (payment.status !== PaymentStatus.SUCCESS) {
    return { outcome: "existing", contribution: null };
  }

  const category = resolvePaymentCategory(
    payment.paymentType,
    payment.paymentCategory,
  );
  if (category === PaymentCategory.CLAIM) {
    return { outcome: "existing", contribution: null };
  }

  const contributionType = resolveContributionTypeFromPayment(payment.paymentType);
  if (!contributionType) {
    const normalized = normalizePaymentType(payment.paymentType);
    throw new PaymentContributionAutomationError(
      normalized
        ? `Payment type "${normalized}" is not configured for contribution automation.`
        : `Payment ${payment.reference} is missing a valid payment type for contribution automation.`,
    );
  }

  // Non-monthly types remain single contribution (legacy path).
  if (contributionType !== ContributionType.MONTHLY_DUES) {
    const existingByReference = await getContributionByPaymentReference(
      payment.reference,
    );
    if (existingByReference) {
      await ensureReceiptFromPayment(payment, existingByReference, actor);
      return { outcome: "existing", contribution: existingByReference };
    }

    const { month, year } = getCurrentMonthYear();
    const contribution = await createAutomatedContribution({
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber,
      contributionType,
      amount: payment.amount,
      month,
      year,
      source: ContributionSource.PAYSTACK,
      paymentReference: payment.reference,
      paymentId: payment.id,
    });

    await logPaymentContributionAudit(payment, actor, {
      outcome: "created",
      contributionId: contribution.id,
      contributionType,
      amount: payment.amount,
      month,
      year,
    });

    await ensureReceiptFromPayment(payment, contribution, actor);
    await notifyContributionReceived(contribution, actor);
    await notifyPaymentRecorded(payment, actor);

    return { outcome: "created", contribution, contributions: [contribution] };
  }

  const targetMonths = resolveTargetMonths(payment);
  const existingForPayment = await listContributionsByPaymentReference(
    payment.reference,
  );
  const existingByMonth = new Map(
    existingForPayment.map((row) => [monthYearKey(row), row]),
  );

  if (
    existingForPayment.length > 0 &&
    existingForPayment.length >= targetMonths.length
  ) {
    await ensureReceiptFromPayment(payment, existingForPayment[0], actor);
    return {
      outcome: "existing",
      contribution: existingForPayment[0],
      contributions: existingForPayment,
    };
  }

  const monthlyDuesAmount = await getMonthlyDuesAmount();
  const amountPerMonth =
    targetMonths.length > 0
      ? Number((payment.amount / targetMonths.length).toFixed(2))
      : monthlyDuesAmount;
  const unitAmount =
    Math.abs(amountPerMonth - monthlyDuesAmount) < 0.01
      ? monthlyDuesAmount
      : amountPerMonth;

  const created: SerializedContribution[] = [...existingForPayment];

  for (const period of targetMonths) {
    const key = monthYearKey(period);
    if (existingByMonth.has(key)) {
      continue;
    }

    const alreadyPaid = await findPaidMonthlyDuesContribution(
      payment.memberId,
      period.month,
      period.year,
    );

    if (alreadyPaid) {
      await logPaymentContributionAudit(payment, actor, {
        outcome: "duplicate_monthly_dues_skipped",
        contributionType,
        amount: unitAmount,
        month: period.month,
        year: period.year,
        existingContributionId: alreadyPaid.id,
        selectedMonths: targetMonths,
      });
      continue;
    }

    const contribution = await createAutomatedContribution({
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber,
      contributionType,
      amount: unitAmount,
      month: period.month,
      year: period.year,
      source: ContributionSource.PAYSTACK,
      paymentReference: payment.reference,
      paymentId: payment.id,
      remarks: `Paid ${formatMonthYearLabel(period)} contribution.`,
    });

    created.push(contribution);
    existingByMonth.set(key, contribution);

    await logPaymentContributionAudit(payment, actor, {
      outcome: "created",
      contributionId: contribution.id,
      contributionType,
      amount: unitAmount,
      month: period.month,
      year: period.year,
      selectedMonths: targetMonths,
    });

    await notifyContributionReceived(contribution, actor);
  }

  if (created.length === 0) {
    return {
      outcome: "duplicate_monthly_dues_skipped",
      contribution: null,
      contributions: [],
    };
  }

  await ensureReceiptFromPayment(payment, created[0], actor);
  await notifyPaymentRecorded(payment, actor);

  const newlyCreatedCount = created.length - existingForPayment.length;

  return {
    outcome:
      newlyCreatedCount <= 0
        ? "existing"
        : newlyCreatedCount < targetMonths.length
          ? "partial"
          : "created",
    contribution: created[created.length - 1] ?? null,
    contributions: created,
  };
}
