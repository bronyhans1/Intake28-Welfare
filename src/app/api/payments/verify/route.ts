import { NextResponse } from "next/server";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { verifyPayment } from "@/lib/payments/repository";
import { PaymentContributionAutomationError } from "@/lib/payments/contribution-automation";
import { verifyPaymentSchema } from "@/lib/validators/payments";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = verifyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid verification request", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const payment = await verifyPayment(parsed.data.reference, actor);
    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify payment.";
    const status = error instanceof PaymentContributionAutomationError ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
