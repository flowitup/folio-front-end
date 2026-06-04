import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-foreground text-5xl font-semibold">403</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          You don&apos;t have permission to access this page.
        </p>
        <Link href="/dashboard" className="btn btn-accent mt-6">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
