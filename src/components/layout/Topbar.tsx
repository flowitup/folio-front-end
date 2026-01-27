"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProjectSelector } from "@/components/project/ProjectSelector";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Topbar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tTopbar = useTranslations("topbar");
  const tCommon = useTranslations("common");
  const { user, logout, isLoading } = useAuth();

  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const pageTitleKeys: Record<string, string> = {
    "/dashboard": "dashboard",
    "/projects": "projects",
    "/settings": "settings",
  };

  const titleKey = pageTitleKeys[pathWithoutLocale] || "dashboard";
  const pageTitle = t(titleKey);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-5">
      {/* Left side - Project selector + Page title */}
      <div className="flex items-center gap-4">
        <ProjectSelector />
        <Separator orientation="vertical" className="h-5" />
        <h1 className="text-base font-medium text-foreground">{pageTitle}</h1>
      </div>

      {/* Right side - user menu */}
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <LanguageSwitcher />

        {/* Notifications */}
        <Button variant="ghost" size="sm" aria-label={tTopbar("viewNotifications")}>
          <Bell className="h-4 w-4" />
        </Button>

        {/* User info and logout */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="text-xs font-medium">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Email */}
            <span className="hidden text-sm font-medium text-foreground sm:block">
              {user.email}
            </span>

            {/* Sign out button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              disabled={isLoading}
            >
              {isLoading ? "..." : tCommon("signOut")}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
