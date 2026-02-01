"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Check if an error is a Next.js redirect or React internal error.
 * These should be re-thrown, not caught by error boundaries.
 */
function isNextJsInternalError(error: unknown): boolean {
  if (error && typeof error === "object") {
    // Next.js redirect throws an error with digest containing "NEXT_REDIRECT"
    if ("digest" in error && typeof (error as { digest?: string }).digest === "string") {
      const digest = (error as { digest: string }).digest;
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Don't log Next.js internal errors
    if (isNextJsInternalError(error)) {
      throw error;
    }
    console.error("Auth error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Authentication Error</h2>
              <p className="text-muted-foreground mt-2">
                Please try refreshing the page or logging in again.
              </p>
              <button
                onClick={() => {
                  // Clear cookies client-side before redirecting
                  document.cookie = "access_token_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  document.cookie = "refresh_token_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  document.cookie = "csrf_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  document.cookie = "csrf_refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  window.location.href = "/en/login";
                }}
                className="mt-4 rounded bg-primary px-4 py-2 text-white"
              >
                Go to Login
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
