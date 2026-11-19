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

const FEATURES = [
  "Profile management",
  "Welfare support visibility",
  "Contributions tracking",
];

export function ActivationSuccessPanel() {
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
        <CardTitle>Welcome to GIS Intake 28 Welfare Portal</CardTitle>
        <CardDescription>
          Your account has been activated successfully. You can now sign in with
          your service number and password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#166534]" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

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
