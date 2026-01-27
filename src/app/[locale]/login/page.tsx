import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Redirect if already authenticated
  const session = await getSession();
  const locale = await getLocale();
  const t = await getTranslations("auth");

  if (session) {
    redirect(`/${locale}/dashboard`);
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || `/${locale}/dashboard`;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md">
        {/* Card Container - Fintech minimal */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-primary)' }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth={2}
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
          <div className="text-center mb-6">
            <h1
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t("welcomeBack")}
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t("signInPrompt")}
            </p>
          </div>

          {/* Login Form */}
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        {/* Footer */}
        <p
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t("contactAdmin")}
        </p>
      </div>
    </div>
  );
}
