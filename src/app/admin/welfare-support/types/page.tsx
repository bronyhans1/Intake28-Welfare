import { redirect } from "next/navigation";
import { AdminWelfareSupportTypesManager } from "@/components/admin/admin-welfare-support-types-manager";
import { AdminBreadcrumb, AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  canManageWelfareSupportTypes,
  listWelfareSupportTypeConfigs,
  seedDefaultWelfareSupportTypes,
} from "@/lib/welfare-support-types/repository";
import { welfareSupportTypeListQuerySchema } from "@/lib/welfare-support-types/validation";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Welfare Support Types",
  "Configure types used when recording standalone welfare support",
);

interface AdminWelfareSupportTypesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminWelfareSupportTypesPage({
  searchParams,
}: AdminWelfareSupportTypesPageProps) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageWelfareSupportTypes(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell title="Welfare Support Types" description="Unavailable">
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured.
        </p>
      </AdminPageShell>
    );
  }

  // Idempotent seed — creates missing default types without overwriting existing ones.
  await seedDefaultWelfareSupportTypes(actor);

  const raw = await searchParams;
  const parsed = welfareSupportTypeListQuerySchema.safeParse({
    page: raw.page,
    pageSize: raw.pageSize,
    search: typeof raw.search === "string" ? raw.search : undefined,
    active: typeof raw.active === "string" ? raw.active : undefined,
  });
  const query = parsed.success
    ? parsed.data
    : welfareSupportTypeListQuerySchema.parse({});
  const data = await listWelfareSupportTypeConfigs(query);

  return (
    <AdminPageShell
      title="Welfare Support Types"
      description="Manage the catalog of support types for standalone welfare assistance recording."
    >
      <AdminBreadcrumb
        items={[
          { label: "Welfare Support", href: "/admin/welfare-support" },
          { label: "Support Types" },
        ]}
      />
      <AdminWelfareSupportTypesManager data={data} canManage />
    </AdminPageShell>
  );
}
