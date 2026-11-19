import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivationStep = "details" | "otp" | "password";

const STEPS: { id: ActivationStep; label: string }[] = [
  { id: "details", label: "Verify Details" },
  { id: "otp", label: "Verify OTP" },
  { id: "password", label: "Create Password" },
];

interface ActivationProgressProps {
  currentStep: ActivationStep;
  completed?: boolean;
  className?: string;
}

export function ActivationProgress({
  currentStep,
  completed = false,
  className,
}: ActivationProgressProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <nav
      aria-label="Activation progress"
      className={cn("mb-6", className)}
    >
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => {
          const isComplete = completed || index < currentIndex;
          const isCurrent = !completed && step.id === currentStep;

          return (
            <li key={step.id} className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  isCurrent &&
                    "border-[#166534] bg-[#166534] text-white",
                  isComplete &&
                    "border-[#166534] bg-[#166534]/10 text-[#166534]",
                  !isCurrent &&
                    !isComplete &&
                    "border-border bg-muted/40 text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? <Check className="size-4" aria-hidden /> : index + 1}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs leading-tight",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
