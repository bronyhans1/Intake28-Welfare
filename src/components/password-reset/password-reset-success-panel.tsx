"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useIsMounted } from "@/hooks/use-is-mounted";

const REDIRECT_SECONDS = 5;

export function PasswordResetSuccessPanel() {
  const router = useRouter();
  const mounted = useIsMounted();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_SECONDS);
  const displaySeconds = mounted ? secondsRemaining : REDIRECT_SECONDS;

  useEffect(() => {
    if (!mounted || secondsRemaining <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsRemaining((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [mounted, secondsRemaining]);

  useEffect(() => {
    if (!mounted || secondsRemaining !== 0) {
      return;
    }

    router.push("/login");
  }, [mounted, secondsRemaining, router]);

  return (
    <Card>
      <CardHeader className="border-b text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#166534]/10 text-[#166534]">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <CardTitle>Password Reset Successful</CardTitle>
        <CardDescription>
          Your password has been updated. You can now sign in with your new
          password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Redirecting to login in {displaySeconds} second
          {displaySeconds === 1 ? "" : "s"}…
        </p>

        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Go To Login
        </Link>
      </CardContent>
    </Card>
  );
}
