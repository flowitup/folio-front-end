"use client";

import { Component, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Check if an error is a Next.js navigation signal: redirect(), or
 * notFound() / forbidden() / unauthorized(), which Next 15+ throw with the
 * digest "NEXT_HTTP_ERROR_FALLBACK;<status>". These must be re-thrown so
 * Next renders the not-found page; catching them turned an ordinary 404
 * into this boundary's session-clearing "Authentication Error" screen.
 */
function isNextJsInternalError(error: unknown): boolean {
  if (error && typeof error === "object") {
    // Next.js redirect throws an error with digest containing "NEXT_REDIRECT"
    if ("digest" in error && typeof (error as { digest?: string }).digest === "string") {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND") ||
        digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;")
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Error boundary for auth-related errors.
 * Catches errors in child components and displays fallback UI.
 * Allows Next.js redirects and internal navigation to pass through.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    // Don't catch Next.js redirects or internal errors
    if (isNextJsInternalError(error)) {
      throw error;
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Don't log Next.js internal errors
    if (isNextJsInternalError(error)) {
      throw error;
    }
    // Log only the message — full Error / ErrorInfo objects carry
    // component stacks and may include request bodies in their
    // `cause` chain in some flows.
    console.error("Auth error boundary caught:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <AuthErrorFallback />;
    }

    return this.props.children;
  }
}

function AuthErrorFallback() {
  const t = useTranslations("authErrorBoundary");
  const locale = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">{t("body")}</p>
        <button
          onClick={() => {
            // Clear cookies client-side before redirecting
            document.cookie = "access_token_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie = "refresh_token_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie = "csrf_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            document.cookie = "csrf_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            window.location.href = `/${locale}/login`;
          }}
          className="mt-4 rounded bg-primary px-4 py-2 text-white"
        >
          {t("goToLogin")}
        </button>
      </div>
    </div>
  );
}
