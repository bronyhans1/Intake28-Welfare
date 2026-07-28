import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TimeOfDayGreeting } from "@/components/dashboard/time-of-day-greeting";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminPageShellProps {
  title: string;
  description?: string;
  greetingFirstName?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AdminPageShell({
  title,
  description,
  greetingFirstName,
  action,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6", className)}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {greetingFirstName ? (
            <TimeOfDayGreeting firstName={greetingFirstName} />
          ) : null}
          <h1
            className={cn(
              "font-bold tracking-tight text-foreground",
              greetingFirstName ? "mt-2 text-lg text-muted-foreground" : "text-2xl",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
          ) : null}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function AdminBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      ← {label}
    </Link>
  );
}
