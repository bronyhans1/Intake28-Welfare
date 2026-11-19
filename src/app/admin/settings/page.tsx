import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { createPageMetadata } from "@/components/shared/page-placeholder";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getSystemInformation } from "@/lib/system-settings/info";
import {
  canManageSettings,
  getSystemSettings,
  serializeSystemSettings,
} from "@/lib/system-settings/repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata(
  "Settings",
  "Configure organization, finance, and communications settings.",
);

export default async function AdminSettingsPage() {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageSettings(actor.role)) {
    redirect("/admin/dashboard");
  }

  if (!isFirebaseAdminConfigured()) {
    return (
      <AdminPageShell
        title="Settings"
        description="Configure organization, finance, and communications settings."
      >
        <p className="text-sm text-muted-foreground">
          Firebase Admin is not configured. Please check server environment variables.
        </p>
      </AdminPageShell>
    );
  }

  const [settings, systemInfo] = await Promise.all([
    getSystemSettings(),
    Promise.resolve(getSystemInformation()),
  ]);

  return (
    <AdminPageShell
      title="Settings"
      description="Manage organization, finance, and communications configuration."
    >
      <SettingsForm
        settings={serializeSystemSettings(settings)}
        systemInfo={systemInfo}
      />
    </AdminPageShell>
  );
}
