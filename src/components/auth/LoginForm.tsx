"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";

interface LoginFormProps {
  callbackUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future callbackUrl redirect
export function LoginForm({ callbackUrl = "/dashboard" }: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    const result = await login({ email, password });

    if (!result.success) {
      setError(result.error || "Invalid credentials");
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Error Alert - Scandinavian minimal */}
      {error && (
        <div
          id="form-error"
          className="rounded-xl p-4"
          style={{
            background: 'var(--status-negative-bg)',
            border: '1px solid var(--status-negative)',
          }}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ color: 'var(--status-negative)' }}
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--status-negative)' }}
            >
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Email Field */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? "form-error" : undefined}
          className="block w-full rounded-xl px-4 py-3 text-base transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-primary-light)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          placeholder="you@example.com"
        />
      </div>

      {/* Password Field */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? "form-error" : undefined}
          className="block w-full rounded-xl px-4 py-3 text-base transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-primary-light)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          placeholder="••••••••"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center items-center gap-2 rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = 'var(--accent-primary-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isLoading ? (
            <>
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </div>
    </form>
  );
}
