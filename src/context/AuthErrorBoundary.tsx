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

// Digest prefixes of Next.js control-flow errors: redirect(), and notFound(),
// forbidden() and unauthorized() ("NEXT_HTTP_ERROR_FALLBACK;404" since
// Next 15; "NEXT_NOT_FOUND" before).
const NEXT_INTERNAL_DIGESTS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

/**
 * Check if an error is a Next.js redirect or HTTP fallback (not found…).
 * These should be re-thrown, not caught by error boundaries.
 */
export function isNextJsInternalError(error: unknown): boolean {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string") {
      return NEXT_INTERNAL_DIGESTS.some((prefix) => digest.startsWith(prefix));
    }
  }
  return false;
}

/** Translated fallback. Keeps the session cookies (the HttpOnly ones can't be
 * cleared from here anyway) and stays in the current locale. */
function AuthErrorFallback() {
  const t = useTranslations("errors.boundary");
  const locale = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-2">{t("body")}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-primary px-4 py-2 text-white"
          >
            {t("refresh")}
          </button>
          <a href={`/${locale}/login`} className="rounded border px-4 py-2">
            {t("login")}
          </a>
        </div>
      </div>
    </div>
  );
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
