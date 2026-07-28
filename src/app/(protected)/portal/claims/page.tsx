import { redirect } from "next/navigation";
import { MemberClaimsDrafts } from "@/components/member/member-claims-drafts";
import { MemberPageShell } from "@/components/member/member-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { canViewOwnClaims, listMemberClaimDrafts } from "@/lib/claims/claim-repository";
import { listActiveClaimTypesForMembers } from "@/lib/claims/claim-type-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { claimDraftListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "My Claims",
  "Manage your welfare claim drafts.",
);

interface PortalClaimsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PortalClaimsPage({
  searchParams,
}: PortalClaimsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  if (!canViewOwnClaims(actor.role)) {
    redirect("/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <MemberPageShell title="My Claims">
        <p className="text-sm text-muted-foreground">
          Claims services are temporarily unavailable. Please try again later.
        </p>
      </MemberPageShell>
    );
  }

  const raw = await searchParams;
  const parsed = claimDraftListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : claimDraftListQuerySchema.parse({});

  const [data, claimTypes] = await Promise.all([
    listMemberClaimDrafts(actor.uid, query),
    listActiveClaimTypesForMembers(),
  ]);

  return (
    <MemberPageShell
      title="My Claims"
      description="Create drafts, review automatic eligibility, and submit claims for Welfare Executive review."
    >
      <MemberClaimsDrafts
        data={data}
        claimTypes={claimTypes}
        memberId={actor.uid}
      />
    </MemberPageShell>
  );
}
