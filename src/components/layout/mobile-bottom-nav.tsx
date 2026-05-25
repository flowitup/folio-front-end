"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderOpen,
  KanbanSquare,
  Receipt,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/ProjectContext";
import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";

export function MobileBottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const { selectedProjectId } = useProject();
  const pathWithoutLocale =
    pathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const [moreOpen, setMoreOpen] = useState(false);

  const items = [
    { key: "dashboard", href: "/dashboard", icon: Home },
    { key: "projects", href: "/projects", icon: FolderOpen },
    ...(selectedProjectId
      ? [
          {
            key: "invoices",
            href: `/projects/${selectedProjectId}/invoices`,
            icon: Receipt,
          },
          {
            key: "planning",
            href: `/projects/${selectedProjectId}/planning`,
            icon: KanbanSquare,
          },
        ]
      : []),
  ];

  const moreIsActive =
    pathWithoutLocale.startsWith("/settings") ||
    pathWithoutLocale.startsWith("/billing") ||
    (selectedProjectId
      ? pathWithoutLocale.startsWith(`/projects/${selectedProjectId}/labor`) ||
        pathWithoutLocale.startsWith(`/projects/${selectedProjectId}/members`) ||
        pathWithoutLocale.startsWith(`/projects/${selectedProjectId}/notes`) ||
        pathWithoutLocale.startsWith(`/projects/${selectedProjectId}/documents`) ||
        pathWithoutLocale.startsWith(`/projects/${selectedProjectId}/settings`)
      : false);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t lg:hidden"
        style={{
          background: "var(--paper)",
          borderColor: "var(--line)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.key === "projects"
                ? pathWithoutLocale === item.href ||
                  /^\/projects\/[^/]+$/.test(pathWithoutLocale)
                : pathWithoutLocale === item.href ||
                  pathWithoutLocale.startsWith(item.href + "/");

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] active:text-[var(--ink)]",
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium transition-colors",
              moreIsActive
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] active:text-[var(--ink)]",
            )}
          >
            <MoreHorizontal size={20} strokeWidth={moreIsActive ? 2.2 : 1.8} />
            <span>{t("more")}</span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
