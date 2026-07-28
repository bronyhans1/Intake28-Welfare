import { Badge } from "@/components/ui/badge";
import { ActivationStatus, UserRole, UserStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

export function RoleBadge({ role }: { role: UserRole | string }) {
  const variant =
    role === UserRole.ADMIN
      ? "default"
      : role === UserRole.TREASURER
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant} className="capitalize">
      {role}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: UserStatus | string }) {
  const className = cn(
    status === UserStatus.ACTIVE && "bg-emerald-100 text-emerald-800 border-emerald-200",
    status === UserStatus.INACTIVE && "bg-slate-100 text-slate-700 border-slate-200",
    status === UserStatus.SUSPENDED && "bg-amber-100 text-amber-800 border-amber-200",
    status === UserStatus.DEACTIVATED && "bg-red-100 text-red-800 border-red-200",
  );

  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}

export function ActivationBadge({
  activationStatus,
}: {
  activationStatus: ActivationStatus | string;
}) {
  const className = cn(
    activationStatus === ActivationStatus.ACTIVATED &&
      "bg-emerald-100 text-emerald-800 border-emerald-200",
    activationStatus === ActivationStatus.PENDING &&
      "bg-amber-100 text-amber-800 border-amber-200",
  );

  return (
    <Badge variant="outline" className={className}>
      {activationStatus}
    </Badge>
  );
}
