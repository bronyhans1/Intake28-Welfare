import { redirect } from "next/navigation";
import { AdminClaimTypesManager } from "@/components/admin/admin-claim-types-manager";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageClaimTypes,
  canViewClaimTypes,
  listClaimTypeConfigs,
} from "@/lib/claims/claim-type-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { claimTypeListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Claim Types",
  "Define welfare benefits members can apply for",
);

interface AdminClaimTypesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminClaimTypesPage({
  searchParams,
}: AdminClaimTypesPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewClaimTypes(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!canManageClaimTypes(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Claim Types" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const raw = await searchParams;
  const parsed = claimTypeListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
    active: typeof raw.active === "string" ? raw.active : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : claimTypeListQuerySchema.parse({});
  const data = await listClaimTypeConfigs(query);

  return (
    <AdminPageShell
      title="Claim Types"
      description="Define the different types of welfare benefits members can apply for."
    >
      <AdminClaimTypesManager data={data} canManage />
    </AdminPageShell>
  );
}
