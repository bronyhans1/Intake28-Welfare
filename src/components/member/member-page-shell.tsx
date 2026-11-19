import Link from "next/link";
import { cn } from "@/lib/utils";

interface MemberPageShellProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function MemberPageShell({
  title,
  description,
  action,
  children,
  className,
}: MemberPageShellProps) {
  const showHeader = Boolean(title || description || action);

  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-8 sm:px-6", className)}>
      {showHeader ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function MemberBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex text-sm font-medium text-[#166534] hover:underline"
    >
      ← {label}
    </Link>
  );
}
