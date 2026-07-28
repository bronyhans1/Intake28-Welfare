"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { toTruthyDataAttribute } from "@/lib/utils/dom-attribute";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
}

export function OtpInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  length = 6,
}: OtpInputProps) {
  const mounted = useIsMounted();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  useEffect(() => {
    if (!mounted) return;
    inputRefs.current[0]?.focus();
  }, [mounted]);

  function updateDigit(index: number, digit: string) {
    const sanitized = digit.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = sanitized;
    onChange(next.join("").slice(0, length));

    if (sanitized && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);

    const focusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div
      className="flex justify-center gap-2"
      role="group"
      aria-label="6-digit verification code"
    >
      {digits.map((digit, index) => (
        mounted ? (
          <Input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-invalid={toTruthyDataAttribute(invalid)}
            className={cn(
              "h-12 w-10 text-center font-mono text-lg tracking-widest sm:w-11",
            )}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event.key)}
            onPaste={handlePaste}
          />
        ) : (
          <div
            key={index}
            aria-hidden
            className={cn(
              "h-12 w-10 rounded-lg border border-input bg-transparent sm:w-11",
            )}
          />
        )
      ))}
    </div>
  );
}
