import { PiggyBank, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ContributionStats } from "@/lib/contributions/repository";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface ContributionsStatsCardsProps {
  stats: ContributionStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentClassName: string;
  valueClassName?: string;
}

function StatCard({
  title,
  value,
  icon,
  accentClassName,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 pt-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight text-foreground",
              valueClassName,
            )}
          >
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            accentClassName,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContributionsStatsCards({ stats }: ContributionsStatsCardsProps) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard
        title="Total Contributions"
        value={stats.totalContributions}
        icon={<PiggyBank className="size-5 text-[#166534]" />}
        accentClassName="bg-[#166534]/10"
      />
      <StatCard
        title="Total Amount Collected"
        value={formatCurrency(stats.totalAmountCollected)}
        icon={<Wallet className="size-5 text-[#166534]" />}
        accentClassName="bg-[#166534]/10"
        valueClassName="text-[#166534]"
      />
      <StatCard
        title="Members Contributed"
        value={stats.membersContributed}
        icon={<Users className="size-5 text-[#166534]" />}
        accentClassName="bg-[#166534]/10"
      />
    </div>
  );
}
