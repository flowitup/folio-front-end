"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { fmtEUR } from "@/lib/projects/budget-display";
import { formatShare } from "@/lib/utils/format-percent";
import { summaryRow, summarize, type SummaryRow } from "@/lib/projects/company-summary";

const DASH = "—";
type SortKey = "name" | "budget" | "spent" | "remaining" | "laborPaid" | "laborUnpaid" | "personal" | "usedPct";

function value(r: SummaryRow, key: SortKey): number | string | null {
  return key === "name" ? projectDisplayName(r.project).toLowerCase() : r[key];
}

function Th({
  k,
  sort,
  onSort,
  children,
  left,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  children: string;
  left?: boolean;
}) {
  return (
    <th scope="col" className={`px-3 py-2.5 font-medium ${left ? "text-left" : "text-right"}`}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:underline">
        {children}
        {sort.key === k && <span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

export default function CompanySummaryPage() {
  const t = useTranslations("companySummary");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { projects, isLoading, error, refetch, selectProject } = useProject();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  // Money moves all day: refresh quietly, as the Projects page does.
  useEffect(() => {
    void refetch({ silent: true });
  }, [refetch]);

  const companies = useMemo(() => {
    const ids = Array.from(new Set(projects.map((p) => p.company_id).filter((c): c is string => !!c)));
    return ids.map((id) => ({
      id,
      name: user?.companies?.find((c) => c.id === id)?.legal_name ?? id.slice(0, 8),
    }));
  }, [projects, user?.companies]);

  const activeId = companyId && companies.some((c) => c.id === companyId) ? companyId : (companies[0]?.id ?? null);
  const companyName = companies.find((c) => c.id === activeId)?.name ?? "";

  const rows = useMemo(() => {
    const list = projects.filter((p) => (activeId ? p.company_id === activeId : true)).map(summaryRow);
    return list.sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : 1) * sort.dir;
    });
  }, [projects, activeId, sort]);
  const totals = useMemo(() => summarize(rows), [rows]);

  const money = (n: number | null) => (n === null ? DASH : fmtEUR(n));
  const pct = (n: number | null) => (n === null ? DASH : formatShare(locale, n));
  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));
  const open = (id: string) => {
    selectProject(id);
    router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            {t("title")}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
            {companyName ? t("subtitle", { company: companyName, count: totals.projectCount }) : t("subtitleNoCompany")}
          </p>
        </div>
        {companies.length > 1 && (
          <select
            aria-label={t("company")}
            value={activeId ?? ""}
            onChange={(e) => setCompanyId(e.target.value)}
            className="rounded-md border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--line)" }}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && projects.length === 0 ? (
        <div className="flex items-center gap-2 py-16 text-sm" style={{ color: "var(--ink-3)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
        </div>
      ) : error ? (
        <p className="py-16 text-sm">{t("loadError")}</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-sm" style={{ color: "var(--ink-3)" }}>
          {t("empty")}
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="company-summary-kpis">
            {[
              [t("totalBudget"), money(totals.budget), false],
              [t("totalSpent"), money(totals.spent), false],
              [t("totalRemaining"), money(totals.remaining), totals.remaining < 0],
              [t("laborOwed"), money(totals.laborUnpaid), false],
            ].map(([label, v, bad]) => (
              <div key={label as string} className="folio-card p-4">
                <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                  {label as string}
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums" style={bad ? { color: "var(--danger, #b3543d)" } : undefined}>
                  {v as string}
                </div>
              </div>
            ))}
          </div>

          <div className="folio-card overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm" data-testid="company-summary-table">
              <thead>
                <tr className="border-b text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  <Th k="name" sort={sort} onSort={sortBy} left>{t("colProject")}</Th>
                  <Th k="budget" sort={sort} onSort={sortBy}>{t("colBudget")}</Th>
                  <Th k="spent" sort={sort} onSort={sortBy}>{t("colSpent")}</Th>
                  <Th k="remaining" sort={sort} onSort={sortBy}>{t("colRemaining")}</Th>
                  <Th k="usedPct" sort={sort} onSort={sortBy}>{t("colUsed")}</Th>
                  <Th k="laborPaid" sort={sort} onSort={sortBy}>{t("colLaborPaid")}</Th>
                  <Th k="laborUnpaid" sort={sort} onSort={sortBy}>{t("colLaborUnpaid")}</Th>
                  <Th k="personal" sort={sort} onSort={sortBy}>{t("colPersonal")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.project.id}
                    onClick={() => open(r.project.id)}
                    className="cursor-pointer border-b tabular-nums hover:bg-black/[0.03]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <td className="px-3 py-2.5 text-left font-medium">{projectDisplayName(r.project)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.budget)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.spent)}</td>
                    <td className="px-3 py-2.5 text-right" style={r.isOver ? { color: "var(--danger, #b3543d)", fontWeight: 600 } : undefined}>
                      {money(r.remaining)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="ml-auto flex w-28 items-center justify-end gap-2">
                        <span>{pct(r.usedPct)}</span>
                        {r.usedPct !== null && (
                          <span className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: "var(--line)" }} aria-hidden="true">
                            <span
                              className="block h-full"
                              style={{
                                width: `${Math.max(0, Math.min(100, r.usedPct))}%`,
                                background: r.isOver ? "var(--danger, #b3543d)" : "var(--ink)",
                              }}
                            />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">{money(r.laborPaid)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.laborUnpaid)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.personal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold tabular-nums" style={{ background: "rgba(0,0,0,0.03)" }}>
                  <td className="px-3 py-3 text-left">{t("total")}</td>
                  <td className="px-3 py-3 text-right">{money(totals.budget)}</td>
                  <td className="px-3 py-3 text-right">{money(totals.spent)}</td>
                  <td className="px-3 py-3 text-right">{money(totals.remaining)}</td>
                  <td className="px-3 py-3 text-right">{pct(totals.usedPct)}</td>
                  <td className="px-3 py-3 text-right">{money(totals.laborPaid)}</td>
                  <td className="px-3 py-3 text-right">{money(totals.laborUnpaid)}</td>
                  <td className="px-3 py-3 text-right">{money(totals.personal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
            {t("footnote")}
          </p>
        </>
      )}
    </div>
  );
}
