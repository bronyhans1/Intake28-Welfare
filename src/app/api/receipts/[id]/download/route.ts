import { NextResponse } from "next/server";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { emitReceiptNotificationEvent } from "@/lib/receipts/events";
import {
  canDownloadReceipts,
  getReceiptById,
  logReceiptDownloadedAudit,
} from "@/lib/receipts/repository";
import { buildReceiptPdfFilename, generateReceiptPdf } from "@/lib/receipts/pdf";
import { NotificationEventType } from "@/lib/notifications/types";
import { ReceiptStatus } from "@/types/receipt";
import { UserRole } from "@/types/enums";

interface ReceiptDownloadRouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: ReceiptDownloadRouteProps,
) {
  const actor = await getCurrentUserFromSession();
  if (!actor || !canDownloadReceipts(actor.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { id } = await params;
  const receipt = await getReceiptById(id);

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.status === ReceiptStatus.CANCELLED) {
    return NextResponse.json({ error: "Receipt is cancelled" }, { status: 410 });
  }

  if (actor.role === UserRole.MEMBER && receipt.memberId !== actor.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdf = await generateReceiptPdf(receipt);
  await logReceiptDownloadedAudit(receipt, actor);
  await emitReceiptNotificationEvent({
    receipt,
    actor,
    eventType: NotificationEventType.RECEIPT_DOWNLOADED,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildReceiptPdfFilename(receipt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
