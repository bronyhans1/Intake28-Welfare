import Link from "next/link";
import {
  CreditCard,
  HeartHandshake,
  Megaphone,
  Receipt,
  UserCircle,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MEMBER_CONTRIBUTIONS_PATH } from "@/lib/contributions/member-dashboard-summary";
import { cn } from "@/lib/utils";

const MEMBER_SERVICE_LINKS = [
  {
    href: MEMBER_CONTRIBUTIONS_PATH,
    label: "My Contributions",
    description: "View your contribution history",
    icon: Wallet,
  },
  {
    href: "/payments",
    label: "Payments",
    description: "Pay dues and review payment history",
    icon: CreditCard,
  },
  {
    href: "/receipts",
    label: "Receipts",
    description: "View and download payment receipts",
    icon: Receipt,
  },
  {
    href: "/portal/welfare-support",
    label: "Welfare Support",
    description: "Review welfare assistance granted to you",
    icon: HeartHandshake,
  },
  {
    href: "/portal/announcements",
    label: "Announcements",
    description: "Read portal announcements for members",
    icon: Megaphone,
  },
  {
    href: "/portal/profile",
    label: "Profile",
    description: "Update your profile and photo",
    icon: UserCircle,
  },
] as const;

interface MemberServicesCardProps {
  className?: string;
}

export function MemberServicesCard({ className }: MemberServicesCardProps) {
  return (
    <Card className={cn("rounded-2xl border border-black/[0.08] bg-white shadow-sm", className)}>
      <CardHeader>
        <CardTitle>Member Services</CardTitle>
        <CardDescription>
          Personal welfare member portal shortcuts alongside your executive duties.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MEMBER_SERVICE_LINKS.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={buttonVariants({
                variant: "outline",
                className: "h-auto justify-start gap-3 rounded-xl px-4 py-3 text-left",
              })}
            >
              <Icon className="size-4 shrink-0 text-[#166534]" />
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
