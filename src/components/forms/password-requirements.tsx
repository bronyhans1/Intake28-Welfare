"use client";

import { Check } from "lucide-react";
import {
  getPasswordRequirements,
  getPasswordStrength,
  type PasswordStrength,
} from "@/lib/utils/password-strength";
import { cn } from "@/lib/utils";

interface PasswordRequirementsListProps {
  password: string;
  showStrength?: boolean;
}

const STRENGTH_STYLES: Record<PasswordStrength, string> = {
  weak: "text-red-600",
  medium: "text-amber-600",
  strong: "text-[#166534]",
};

const STRENGTH_BAR: Record<PasswordStrength, string> = {
  weak: "w-1/3 bg-red-500",
  medium: "w-2/3 bg-amber-500",
  strong: "w-full bg-[#166534]",
};

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Check
        className={cn(
          "size-4 shrink-0",
          met ? "text-[#166534]" : "text-muted-foreground/40",
        )}
        aria-hidden
      />
      <span className={cn(met ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </li>
  );
}

export function PasswordRequirementsList({
  password,
  showStrength = true,
}: PasswordRequirementsListProps) {
  const requirements = getPasswordRequirements(password);
  const strength = getPasswordStrength(password);

  return (
    <div className="space-y-3 rounded-lg border border-black/[0.08] bg-muted/20 px-3 py-3">
      <ul className="space-y-1.5" aria-live="polite">
        <RequirementItem met={requirements.minLength} label="Minimum 8 characters" />
        <RequirementItem met={requirements.uppercase} label="Uppercase letter" />
        <RequirementItem met={requirements.lowercase} label="Lowercase letter" />
        <RequirementItem met={requirements.number} label="Number" />
      </ul>

      {showStrength ? (
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", STRENGTH_BAR[strength])}
            />
          </div>
          <p className={cn("text-xs font-medium capitalize", STRENGTH_STYLES[strength])}>
            {strength}
          </p>
        </div>
      ) : null}
    </div>
  );
}
