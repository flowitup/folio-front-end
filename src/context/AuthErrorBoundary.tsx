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
 * Error boundary for auth-related errors.
 * Catches errors in child components and displays fallback UI.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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
                onClick={() => (window.location.href = "/login")}
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
