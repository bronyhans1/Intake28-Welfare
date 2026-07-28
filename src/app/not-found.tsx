import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="text-sm text-muted-foreground">
        The page you requested does not exist or is no longer available.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-[#166534] hover:underline"
      >
        Return to dashboard
      </Link>
    </main>
  );
}
