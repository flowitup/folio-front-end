"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { LayoutGrid, FolderOpen, Settings, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");

  const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const navigation = [
    { key: "dashboard", href: "/dashboard", icon: LayoutGrid },
    { key: "projects", href: "/projects", icon: FolderOpen },
    { key: "settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-foreground">
              {tCommon("appName")}
            </span>
            <p className="text-xs text-muted-foreground">{tCommon("appTagline")}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathWithoutLocale === item.href || pathWithoutLocale.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t px-5 py-4">
        <p className="text-xs text-muted-foreground">{tCommon("copyright")}</p>
      </div>
    </aside>
  );
}
