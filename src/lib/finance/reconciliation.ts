import { fetchAllContributionsForReport } from "@/lib/reports/data";
import { getReceiptByPaymentReference, listReceipts } from "@/lib/receipts/repository";
import { getPaymentByReference } from "@/lib/payments/repository";
import { PaymentStatus } from "@/types/enums";
import type { SerializedContribution } from "@/types/contribution";
import type { SerializedPayment } from "@/types/payment";
import type { SerializedReceipt } from "@/types/receipt";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import type { Payment } from "@/types/payment";

export interface ReconciliationSummary {
  paymentsMissingContributions: {
    count: number;
    records: SerializedPayment[];
  };
  contributionsMissingReceipts: {
    count: number;
    records: SerializedContribution[];
  };
  receiptsMissingPayments: {
    count: number;
    records: SerializedReceipt[];
  };
  isBalanced: boolean;
}

async function fetchAllSuccessPayments(): Promise<SerializedPayment[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("status", "==", PaymentStatus.SUCCESS)
    .get();

  return snapshot.docs.map((doc) => {
    const { id, ...rest } = { id: doc.id, ...doc.data() } as Payment;
    return serializeFirestoreDoc<SerializedPayment>(id, rest as Record<string, unknown>) as unknown as SerializedPayment;
  });
}

export async function getReconciliationSummary(): Promise<ReconciliationSummary> {
  const [successPayments, contributions, receiptsResult] = await Promise.all([
    fetchAllSuccessPayments(),
    fetchAllContributionsForReport({}),
    listReceipts({ page: 1, pageSize: 10_000 }),
  ]);

  const receipts = receiptsResult.records;
  const contributionByReference = new Map(
    contributions
      .filter((item) => item.paymentReference)
      .map((item) => [item.paymentReference as string, item]),
  );
  const receiptByReference = new Map(
    receipts.map((item) => [item.paymentReference, item]),
  );

  const paymentsMissingContributions = successPayments.filter(
    (payment) => !contributionByReference.has(payment.reference),
  );

  const contributionsMissingReceipts = contributions.filter((contribution) => {
    if (!contribution.paymentReference) {
      return false;
    }
    return !receiptByReference.has(contribution.paymentReference);
  });

  const receiptsMissingPayments: SerializedReceipt[] = [];
  for (const receipt of receipts) {
    const payment = await getPaymentByReference(receipt.paymentReference);
    if (!payment || payment.status !== PaymentStatus.SUCCESS) {
      receiptsMissingPayments.push(receipt);
    }
  }

  const summary: ReconciliationSummary = {
    paymentsMissingContributions: {
      count: paymentsMissingContributions.length,
      records: paymentsMissingContributions,
    },
    contributionsMissingReceipts: {
      count: contributionsMissingReceipts.length,
      records: contributionsMissingReceipts,
    },
    receiptsMissingPayments: {
      count: receiptsMissingPayments.length,
      records: receiptsMissingPayments,
    },
    isBalanced:
      paymentsMissingContributions.length === 0 &&
      contributionsMissingReceipts.length === 0 &&
      receiptsMissingPayments.length === 0,
  };

  return summary;
}

export async function getReceiptByPaymentReferenceForReconciliation(
  paymentReference: string,
) {
  return getReceiptByPaymentReference(paymentReference);
}
