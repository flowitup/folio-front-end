"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Topbar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tTopbar = useTranslations("topbar");
  const tCommon = useTranslations("common");
  const { user, logout, isLoading } = useAuth();

  // Extract path without locale prefix for title matching
  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const pageTitleKeys: Record<string, string> = {
    "/dashboard": "dashboard",
    "/projects": "projects",
    "/settings": "settings",
  };

  const titleKey = pageTitleKeys[pathWithoutLocale] || "dashboard";
  const pageTitle = t(titleKey);

  return (
    <header
      className="flex h-20 items-center justify-between px-8"
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left side - Project selector + Page title */}
      <div className="flex items-center gap-5">
        <ProjectSelector />
        <div
          className="h-6 w-px"
          style={{ background: 'var(--border-default)' }}
        />
        <h1
          className="text-lg font-medium font-outfit"
          style={{ color: 'var(--text-primary)' }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* Right side - user menu */}
      <div className="flex items-center gap-5">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Notifications */}
        <button
          className="cursor-pointer rounded-xl p-2.5 transition-all duration-200"
          style={{
            color: 'var(--text-secondary)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          aria-label={tTopbar("viewNotifications")}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </button>

        {/* User info and logout */}
        {user && (
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
              }}
            >
              <span className="text-sm font-medium">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Email */}
            <span
              className="text-sm font-medium hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
              {user.email}
            </span>

            {/* Sign out button */}
            <button
              onClick={() => logout()}
              disabled={isLoading}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-muted)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {isLoading ? "..." : tCommon("signOut")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
