import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Redirect if already authenticated
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/dashboard";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md">
        {/* Card Container - Scandinavian minimal */}
        <div
          className="rounded-3xl p-10"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'var(--accent-primary)' }}
            >
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                />
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-semibold tracking-tight font-outfit"
              style={{ color: 'var(--text-primary)' }}
            >
              Welcome back
            </h1>
            <p
              className="mt-2 text-base"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sign in to your account to continue
            </p>
          </div>

          {/* Login Form */}
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-center text-sm"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Contact your administrator if you need access.
        </p>
      </div>
    </div>
  );
}
