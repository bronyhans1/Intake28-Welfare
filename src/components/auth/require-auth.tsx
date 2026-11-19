"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { canAccessAdminRoute } from "@/lib/auth/login";
import {
  canAccessMemberPortal,
  getMemberPortalAccessRedirect,
} from "@/lib/auth/member-portal-access";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export function RequireMember({ children }: RequireAuthProps) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!canAccessMemberPortal(user.role)) {
      router.replace(getMemberPortalAccessRedirect(user.role, pathname));
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !canAccessMemberPortal(user.role)) {
    return null;
  }

  return <>{children}</>;
}

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!canAccessAdminRoute(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !canAccessAdminRoute(user.role)) {
    return null;
  }

  return <>{children}</>;
}
