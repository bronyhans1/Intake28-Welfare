import type { Metadata } from "next";

interface PagePlaceholderProps {
  title: string;
  description: string;
  route: string;
  access?: string;
}

export function PagePlaceholder({
  title,
  description,
  route,
  access = "Reserved route — implementation in Phase 2",
}: PagePlaceholderProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-8 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">{route}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {access}
        </p>
      </div>
    </main>
  );
}

export function createPageMetadata(
  title: string,
  description?: string,
): Metadata {
  return {
    title,
    description: description ?? title,
  };
}
