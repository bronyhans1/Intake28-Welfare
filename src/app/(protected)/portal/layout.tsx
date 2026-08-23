import { redirect } from "next/navigation";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { requireOwnMemberPortalAccess } from "@/lib/auth/require-member-portal";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentUserFromSession();

  if (!actor) {
    redirect("/login");
  }

  await requireOwnMemberPortalAccess(actor, "/portal");

  return children;
}
