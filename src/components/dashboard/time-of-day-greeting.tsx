"use client";

import { useEffect, useState } from "react";
import { getTimeOfDayGreeting } from "@/lib/utils/greeting";
import { cn } from "@/lib/utils";

interface TimeOfDayGreetingProps {
  firstName: string;
  className?: string;
}

export function TimeOfDayGreeting({ firstName, className }: TimeOfDayGreetingProps) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting(firstName));
  }, [firstName]);

  if (!greeting) {
    return (
      <p
        className={cn(
          "text-xl font-semibold tracking-tight text-foreground sm:text-2xl",
          className,
        )}
        aria-busy="true"
      >
        Welcome, {firstName}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-xl font-semibold tracking-tight text-foreground sm:text-2xl",
        className,
      )}
    >
      {greeting}
    </p>
  );
}
