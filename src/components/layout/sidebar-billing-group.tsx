"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  FileSpreadsheet,
  FileText,
  FileCheck,
  LayoutTemplate,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BILLING_NAV = [
  { key: "devis", href: "/billing/devis", icon: FileText },
  { key: "factures", href: "/billing/factures", icon: FileCheck },
  { key: "templates", href: "/billing/templates", icon: LayoutTemplate },
] as const;

const STORAGE_KEY = "sidebar.billing.open";

interface SidebarBillingGroupProps {
  pathWithoutLocale: string;
}

export function SidebarBillingGroup({ pathWithoutLocale }: SidebarBillingGroupProps) {
  const t = useTranslations("sidebar.billing");

  const isAnyChildActive = BILLING_NAV.some(
    (item) =>
      pathWithoutLocale === item.href ||
      pathWithoutLocale.startsWith(item.href + "/"),
  );

  // Initialize closed — will be corrected on first useEffect run (avoids SSR hydration mismatch)
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setOpen(stored === "true");
    } else {
      // Default: expand when a child route is active
      setOpen(isAnyChildActive);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="mb-1">
      {/* Group header */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "nav-link w-full justify-between",
          isAnyChildActive && "text-[var(--accent)]",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="nav-icon flex w-5 items-center justify-center">
            <FileSpreadsheet size={16} />
          </span>
          <span className="font-medium">{t("title")}</span>
        </span>
        <ChevronRight
          size={14}
          style={{ color: "var(--muted)" }}
          className={cn("transition-transform duration-200", open && "rotate-90")}
        />
      </button>

      {/* Sub-entries */}
      {open && (
        <div className="mt-0.5 ml-3 space-y-0.5 border-l pl-3" style={{ borderColor: "var(--line)" }}>
          {BILLING_NAV.map((item) => {
            const isActive =
              pathWithoutLocale === item.href ||
              pathWithoutLocale.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn("nav-link", isActive && "active")}
              >
                <span className="nav-icon flex w-5 items-center justify-center">
                  <Icon size={15} />
                </span>
                <span className="font-medium">{t(item.key)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
