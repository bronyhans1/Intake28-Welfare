import { redirect } from "next/navigation";
import { AdminConstitutionsManager } from "@/components/admin/admin-constitutions-manager";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  canManageConstitutions,
  canViewConstitutions,
  allocateNextConstitutionId,
  getActiveConstitution,
  listConstitutionDrafts,
} from "@/lib/claims/constitution-repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { constitutionListQuerySchema } from "@/lib/validators/claims";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Constitutions",
  "Manage the official welfare constitution",
);

interface AdminConstitutionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminConstitutionsPage({
  searchParams,
}: AdminConstitutionsPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canViewConstitutions(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!canManageConstitutions(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Constitutions" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  const raw = await searchParams;
  const parsed = constitutionListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : constitutionListQuerySchema.parse({});
  const [data, currentConstitution, nextVersionId] = await Promise.all([
    listConstitutionDrafts(query),
    getActiveConstitution(),
    allocateNextConstitutionId(),
  ]);

  return (
    <AdminPageShell
      title="Constitutions"
      description="Upload and manage the official constitution used by all members."
    >
      <AdminConstitutionsManager
        data={data}
        currentConstitution={currentConstitution}
        nextVersionId={nextVersionId}
        canManage
      />
    </AdminPageShell>
  );
}
