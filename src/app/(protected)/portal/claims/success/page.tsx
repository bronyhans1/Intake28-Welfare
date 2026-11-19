import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { buttonVariants } from "@/components/ui/button";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canViewOwnClaims } from "@/lib/claims/claim-repository";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Claim Submitted",
  "Your membership claim was submitted successfully",
);

interface ClaimSuccessPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimSuccessPage({
  searchParams,
}: ClaimSuccessPageProps) {
  const actor = await getCurrentUserFromSession();
  if (!actor) redirect("/login");
  if (!canViewOwnClaims(actor.role)) redirect("/dashboard");

  const raw = await searchParams;
  const claimNumber =
    typeof raw.claimNumber === "string" ? raw.claimNumber.trim() : "";

  if (!claimNumber) {
    redirect("/portal/claims");
  }

  return (
    <MemberPageShell title="Claim Submitted">
      <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-emerald-950">
          ✅ Claim Submitted Successfully
        </p>
        <div>
          <p className="text-sm text-emerald-900/80">Claim Number</p>
          <p className="mt-1 text-2xl font-semibold tracking-wide text-emerald-950">
            {claimNumber}
          </p>
        </div>
        <p className="text-sm text-emerald-950">
          Your claim has been submitted successfully.
        </p>
        <p className="text-sm text-emerald-900/90">
          The Welfare Executives will review your submission and contact you if
          additional information is required.
        </p>
        <Link
          href="/portal/claims"
          className={cn(
            buttonVariants({ variant: "default" }),
            "bg-[#166534] text-white hover:bg-[#14532d]",
          )}
        >
          Back to My Claims
        </Link>
      </div>
    </MemberPageShell>
  );
}
