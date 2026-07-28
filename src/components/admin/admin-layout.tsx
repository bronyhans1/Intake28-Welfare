"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  Coins,
  FileText,
  GitCompare,
  HandHeart,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  Bell,
  PieChart,
  Scale,
  Settings,
  ClipboardList,
  UserPlus,
  UserRoundPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { AdminUserAvatar } from "@/components/admin/admin-user-avatar";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { RoleBadge } from "@/components/admin/member-badges";
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
import { cn } from "@/lib/utils";
import { UserRole } from "@/types/enums";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  disabled?: boolean;
  matchPrefix?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Dashboard",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Members",
    items: [
      {
        href: "/admin/members",
        label: "All Members",
        icon: Users,
        matchPrefix: true,
      },
      {
        href: "/admin/members/new",
        label: "Add Member",
        icon: UserPlus,
        adminOnly: true,
      },
      {
        href: "/admin/members/pending",
        label: "Pending Activation",
        icon: Clock,
      },
      {
        href: "/admin/membership-requests",
        label: "Membership Requests",
        icon: UserRoundPlus,
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        href: "/admin/finance",
        label: "Dashboard",
        icon: Landmark,
      },
      {
        href: "/admin/finance/defaulters",
        label: "Defaulters",
        icon: UserX,
        matchPrefix: true,
      },
      {
        href: "/admin/finance/reconciliation",
        label: "Reconciliation",
        icon: GitCompare,
        matchPrefix: true,
      },
      {
        href: "/admin/contributions",
        label: "Contributions",
        icon: Coins,
        matchPrefix: true,
      },
      {
        href: "/admin/welfare-support",
        label: "Welfare Support",
        icon: HandHeart,
        matchPrefix: true,
      },
      {
        href: "/admin/claims/submitted",
        label: "Submitted Claims",
        icon: ClipboardList,
        matchPrefix: true,
      },
      {
        href: "/admin/claims/types",
        label: "Claim Types",
        icon: ClipboardList,
        matchPrefix: true,
        adminOnly: true,
      },
      {
        href: "/admin/claims/eligibility",
        label: "Claim Eligibility",
        icon: ClipboardList,
        matchPrefix: true,
        adminOnly: true,
      },
    ],
  },
  {
    title: "Activity",
    items: [
      {
        href: "/admin/audit-logs",
        label: "Audit Logs",
        icon: FileText,
      },
      {
        href: "/admin/reports",
        label: "Reports",
        icon: PieChart,
        matchPrefix: true,
      },
      {
        href: "/admin/announcements",
        label: "Announcements",
        icon: Megaphone,
        matchPrefix: true,
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
        matchPrefix: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        href: "/admin/constitutions",
        label: "Constitutions",
        icon: Scale,
        matchPrefix: true,
        adminOnly: true,
      },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
];

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.disabled) {
    return false;
  }

  if (item.href === "/admin/members") {
    return (
      pathname === "/admin/members" ||
      (pathname.startsWith("/admin/members/") &&
        pathname !== "/admin/members/new" &&
        pathname !== "/admin/members/pending")
    );
  }

  if (item.href === "/admin/members/pending") {
    return pathname === "/admin/members/pending";
  }

  if (item.href === "/admin/membership-requests") {
    return (
      pathname === "/admin/membership-requests" ||
      pathname.startsWith("/admin/membership-requests/")
    );
  }

  if (item.href === "/admin/finance") {
    return pathname === "/admin/finance";
  }

  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

function SidebarNav({
  pathname,
  canManage,
  onNavigate,
}: {
  pathname: string;
  canManage: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-7 px-4">
      {NAV_SECTIONS.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.adminOnly || canManage,
        );

        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <div key={section.title} className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {section.title}
            </p>
            {visibleItems.map((item) => {
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
          </div>
        );
      })}
    </nav>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const canManage = user?.role === UserRole.ADMIN;

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
          <PortalBranding subtitle="Management Console" />
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
            canManage={!!canManage}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
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
              <AdminUserAvatar
                fullName={user?.fullName ?? "Admin User"}
                profilePhotoUrl={user?.profilePhotoUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {loading ? "Loading…" : user?.fullName ?? "Admin User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.serviceNumber ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {user?.role === UserRole.ADMIN || user?.role === UserRole.TREASURER ? (
                <AdminNotificationBell />
              ) : null}
              {user ? <RoleBadge role={user.role} /> : null}
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
