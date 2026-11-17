"use client";

import { useTranslations } from "next-intl";

export type OverviewScope = "project" | "company";

/** "Project / Company" switch at the top of the Overview. */
export function OverviewScopeToggle({ scope, onChange }: { scope: OverviewScope; onChange: (s: OverviewScope) => void }) {
  const t = useTranslations("dashboard.company");
  const option = (value: OverviewScope, label: string) => (
    <button
      type="button"
      aria-pressed={scope === value}
      onClick={() => onChange(value)}
      className="min-h-[40px] rounded-[10px] px-4 text-[13.5px] transition-colors"
      style={
        scope === value
          ? { background: "var(--card-paper)", color: "var(--ink)", fontWeight: 600, boxShadow: "0 2px 6px -2px rgba(26,26,26,0.18)" }
          : { color: "var(--muted)", fontWeight: 500 }
      }
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex gap-0.5 rounded-[14px] p-1" style={{ background: "var(--paper-2)" }} data-testid="overview-scope-toggle">
      {option("project", t("scopeProject"))}
      {option("company", t("scopeCompany"))}
    </div>
  );
}
