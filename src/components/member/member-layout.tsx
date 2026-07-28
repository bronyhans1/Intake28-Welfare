"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  HandHeart,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  PiggyBank,
  User,
  X,
} from "lucide-react";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { RoleBadge } from "@/components/admin/member-badges";
import { MemberNotificationBell } from "@/components/member/member-notification-bell";
import { ProfileCompletionBanner } from "@/components/member/profile-completion-banner";
import { PortalBranding } from "@/components/shared/portal-branding";
import { useCurrentUser } from "@/components/providers/auth-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  EXECUTIVE_DASHBOARD_PATH,
  getExecutiveDashboardReturnLabel,
} from "@/lib/navigation/executive-workspace";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/types/auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  matchPrefix?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/portal/profile",
    label: "My Profile",
    icon: User,
    matchPrefix: true,
  },
  {
    href: "/portal/welfare-support",
    label: "Welfare Support",
    icon: HandHeart,
    matchPrefix: true,
  },
  {
    href: "/portal/claims",
    label: "My Claims",
    icon: ClipboardList,
    matchPrefix: true,
  },
  {
    href: "/portal/contributions",
    label: "Contributions",
    icon: PiggyBank,
    matchPrefix: true,
  },
  {
    href: "/portal/announcements",
    label: "Announcements",
    icon: Megaphone,
    matchPrefix: true,
  },
  {
    href: "/portal/notifications",
    label: "Notifications",
    icon: Bell,
    matchPrefix: true,
  },
];

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.disabled) {
    return false;
  }

  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-2 px-4">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item);

        if (item.disabled) {
          return (
            <div
              key={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/70"
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide">
                Soon
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-[#166534] text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  user,
  onNavigate,
}: {
  user: CurrentUser;
  onNavigate?: () => void;
}) {
  const executiveLabel = getExecutiveDashboardReturnLabel(user.role);
  if (!executiveLabel) {
    return null;
  }

  return (
    <div className="mt-auto border-t border-black/[0.08] px-4 py-5">
      <Link
        href={EXECUTIVE_DASHBOARD_PATH}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LayoutDashboard className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{executiveLabel}</span>
        <RoleBadge role={user.role} />
      </Link>
    </div>
  );
}

export function MemberLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setLogoutOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-black/[0.08] bg-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-6">
          <PortalBranding subtitle="Member Portal" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto py-5">
          <SidebarNav
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        {user && getExecutiveDashboardReturnLabel(user.role) ? (
          <SidebarFooter
            user={user}
            onNavigate={() => setMobileOpen(false)}
          />
        ) : null}
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-white/95 backdrop-blur">
          <div className="flex h-14 flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
              <MemberAvatar
                fullName={user?.fullName ?? "Member"}
                profilePhotoUrl={user?.profilePhotoUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {loading ? "Loading…" : user?.fullName ?? "Member"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.serviceNumber ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <MemberNotificationBell />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogoutOpen(true)}
                disabled={loggingOut || loading}
                className="shrink-0"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        <ProfileCompletionBanner />

        <main>{children}</main>
      </div>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of the GIS Welfare Portal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#166534] text-white hover:bg-[#14532d]"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing out…
                </>
              ) : (
                "Sign Out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
