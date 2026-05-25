"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import {
  HardHat,
  Users,
  StickyNote,
  Files,
  FileText,
  FileCheck,
  LayoutTemplate,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/ProjectContext";

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tBilling = useTranslations("sidebar.billing");
  const { selectedProjectId } = useProject();
  const pathWithoutLocale =
    pathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const projectItems = selectedProjectId
    ? [
        { key: "labor", href: `/projects/${selectedProjectId}/labor`, icon: HardHat },
        { key: "members", href: `/projects/${selectedProjectId}/members`, icon: Users },
        { key: "notes", href: `/projects/${selectedProjectId}/notes`, icon: StickyNote },
        { key: "documents", href: `/projects/${selectedProjectId}/documents`, icon: Files },
        { key: "projectSettings", href: `/projects/${selectedProjectId}/settings`, icon: Settings },
      ]
    : [];

  const billingItems = [
    { key: "devis", href: "/billing/devis", icon: FileText, label: tBilling("devis") },
    { key: "factures", href: "/billing/factures", icon: FileCheck, label: tBilling("factures") },
    { key: "templates", href: "/billing/templates", icon: LayoutTemplate, label: tBilling("templates") },
  ];

  const settingsItem = { key: "settings", href: "/settings", icon: Settings };

  const isActive = (href: string) =>
    pathWithoutLocale === href || pathWithoutLocale.startsWith(href + "/");

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl lg:hidden"
        style={{
          background: "var(--paper)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold">{t("more")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "var(--paper-2)" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="px-3 pb-4">
          {projectItems.length > 0 && (
            <div className="mb-2">
              {projectItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors",
                      active
                        ? "bg-[var(--paper-2)] text-[var(--accent)]"
                        : "text-[var(--ink)] active:bg-[var(--paper-2)]",
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {projectItems.length > 0 && (
            <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--line)" }} />
          )}

          <div className="mb-2">
            <div
              className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--muted)" }}
            >
              {tBilling("title")}
            </div>
            {billingItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors",
                    active
                      ? "bg-[var(--paper-2)] text-[var(--accent)]"
                      : "text-[var(--ink)] active:bg-[var(--paper-2)]",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--line)" }} />

          <Link
            href={settingsItem.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-medium transition-colors",
              isActive(settingsItem.href)
                ? "bg-[var(--paper-2)] text-[var(--accent)]"
                : "text-[var(--ink)] active:bg-[var(--paper-2)]",
            )}
          >
            <Settings size={18} strokeWidth={isActive(settingsItem.href) ? 2.2 : 1.8} />
            <span>{t("settings")}</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
