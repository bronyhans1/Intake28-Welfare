import Link from "next/link";
import { PROFILE_COMPLETION_FIELD_LABELS } from "@/lib/constants/profile-completion";
import type { ProfileCompletionResult } from "@/lib/utils/profile-completion";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProfileCompletionCardProps {
  completion: ProfileCompletionResult;
}

export function ProfileCompletionCard({ completion }: ProfileCompletionCardProps) {
  const percentage = completion.profileCompletionPercentage;
  const missingLabels = completion.missingFields.map(
    (field) => PROFILE_COMPLETION_FIELD_LABELS[field],
  );

  return (
    <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Profile Completion</CardTitle>
        <CardDescription>
          {completion.isEligible
            ? "Complete your profile to unlock all welfare services."
            : "Profile progress is available after account activation."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {percentage}%
            </p>
            <p className="text-sm text-muted-foreground">
              {completion.completedCount} of {completion.totalFields} fields
            </p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <div
              className={cn(
                "h-full rounded-full bg-[#166534] transition-all",
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {missingLabels.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-foreground">Missing:</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {missingLabels.map((label) => (
                <li key={label}>• {label}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[#166534]">Your profile is complete.</p>
        )}

        {percentage < 100 ? (
          <Link
            href="/portal/profile/edit"
            className={buttonVariants({
              className: "bg-[#166534] text-white hover:bg-[#14532d]",
            })}
          >
            Complete Profile
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
