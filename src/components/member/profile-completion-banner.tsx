"use client";

import Link from "next/link";
import { useCurrentUser } from "@/components/providers/auth-provider";
import { buttonVariants } from "@/components/ui/button";
import { shouldShowProfileCompletionBanner } from "@/lib/member/profile-banner";
import { cn } from "@/lib/utils";

export function ProfileCompletionBanner() {
  const { user } = useCurrentUser();

  if (!user || !shouldShowProfileCompletionBanner(user.profileCompletionPercentage)) {
    return null;
  }

  return (
    <div className="border-b border-[#166534]/20 bg-[#166534]/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-foreground">
          Complete your profile to access all welfare services.
        </p>
        <Link
          href="/portal/profile/edit"
          className={cn(
            buttonVariants({ size: "sm" }),
            "shrink-0 bg-[#166534] text-white hover:bg-[#14532d]",
          )}
        >
          Complete Profile
        </Link>
      </div>
    </div>
  );
}
