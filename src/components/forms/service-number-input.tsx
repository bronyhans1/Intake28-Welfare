import { SERVICE_NUMBER_PREFIX } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { toTruthyDataAttribute } from "@/lib/utils/dom-attribute";
import { cn } from "@/lib/utils";

interface ServiceNumberInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type"> {
  invalid?: boolean;
}

export function ServiceNumberInput({
  className,
  invalid,
  id,
  ...props
}: ServiceNumberInputProps) {
  const isInvalid = Boolean(invalid);

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-lg border border-input bg-background shadow-sm transition-colors",
        "focus-within:border-[#166534] focus-within:ring-3 focus-within:ring-[#166534]/25",
        isInvalid &&
          "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-10 shrink-0 items-center border-r border-input bg-muted/50 px-3 text-sm font-semibold text-muted-foreground"
      >
        {SERVICE_NUMBER_PREFIX}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="13984"
        aria-invalid={toTruthyDataAttribute(isInvalid)}
        className={cn(
          "h-10 rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}
