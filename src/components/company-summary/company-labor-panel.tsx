"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { Project } from "@/types/project";
import { fetchLaborMonthlySummary, fetchLaborPaymentsSummary } from "@/lib/api/labor";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { fmtEUR } from "@/lib/projects/budget-display";
import { formatDays } from "@/components/labor/format-days";
import { companyLabor, laborMonths, type ProjectLaborInput } from "@/lib/projects/company-labor";

const ALL = "all";
const DANGER = { color: "var(--danger, #b3543d)", fontWeight: 600 } as const;
/** Projects loaded at a time: two requests each, kept well under the API's per-minute limit. */
const BATCH = 4;

async function loadAll(projects: readonly Project[]): Promise<{ inputs: ProjectLaborInput[]; failed: number }> {
  const inputs: ProjectLaborInput[] = [];
  let failed = 0;
  for (let i = 0; i < projects.length; i += BATCH) {
    const settled = await Promise.allSettled(
      projects.slice(i, i + BATCH).map(async (p) => {
        const [monthly, payments] = await Promise.all([fetchLaborMonthlySummary(p.id), fetchLaborPaymentsSummary(p.id)]);
        return { projectId: p.id, projectName: projectDisplayName(p), monthly, payments };
      }),
    );
    for (const s of settled) {
      if (s.status === "fulfilled") inputs.push(s.value);
      else failed += 1;
    }
  }
  return { inputs, failed };
}

export function CompanyLaborPanel({ projects, onOpenProject }: { projects: readonly Project[]; onOpenProject: (id: string) => void }) {
  const t = useTranslations("companySummary");
  const locale = useLocale();
  const [data, setData] = useState<{ inputs: ProjectLaborInput[]; failed: number } | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [view, setView] = useState<"workers" | "projects">("workers");
  const ids = projects.map((p) => p.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    void loadAll(projects).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the project ids: the list object changes on every silent refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const months = useMemo(() => (data ? laborMonths(data.inputs) : []), [data]);
  // Default: the most recent month with attendance or payments.
  const active = month ?? months[0] ?? ALL;
  const result = useMemo(() => (data ? companyLabor(data.inputs, active === ALL ? null : active) : null), [data, active]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  };

  if (!data || !result) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm" style={{ color: "var(--ink-3)" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  const { totals } = result;
  const tabBtn = (v: "workers" | "projects", label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className="rounded-md px-3 py-1.5 text-sm font-medium"
      style={view === v ? { background: "var(--ink)", color: "var(--paper)" } : { color: "var(--ink-3)" }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)" }}>
          {tabBtn("workers", t("byWorker"))}
          {tabBtn("projects", t("byProject"))}
        </div>
        <select
          aria-label={t("month")}
          value={active}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)" }}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
          <option value={ALL}>{t("allMonths")}</option>
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="company-labor-kpis">
        {(
          [
            [t("laborDays"), formatDays(totals.days, locale), t("workerCount", { count: totals.workerCount }), false],
            [t("laborEarned"), fmtEUR(totals.earned), null, false],
            [t("laborPaid"), fmtEUR(totals.paid), totals.unassignedPaid > 0 ? t("unassignedPaid", { amount: fmtEUR(totals.unassignedPaid) }) : null, false],
            [t("laborOwed"), fmtEUR(totals.owed), null, totals.owed > 0],
          ] as const
        ).map(([label, v, sub, bad]) => (
          <div key={label} className="folio-card p-4">
            <div className="text-xs" style={{ color: "var(--ink-3)" }}>
              {label}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums" style={bad ? { color: "var(--danger, #b3543d)" } : undefined}>
              {v}
            </div>
            {sub && (
              <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
                {sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {result.workers.length === 0 ? (
        <p className="py-10 text-sm" style={{ color: "var(--ink-3)" }}>
          {t("laborEmpty")}
        </p>
      ) : (
        <div className="folio-card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm" data-testid="company-labor-table">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">
                  {view === "workers" ? t("colWorker") : t("colProject")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("laborDays")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("laborEarned")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("laborPaid")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t("laborOwed")}</th>
              </tr>
            </thead>
            <tbody>
              {view === "workers"
                ? result.workers.map((w) => (
                    <tr key={w.key} className="border-b tabular-nums" style={{ borderColor: "var(--line)" }}>
                      <td className="px-3 py-2.5 text-left">
                        <div className="font-medium">{w.name}</div>
                        {w.projects.length > 0 && (
                          <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
                            {w.projects.map((p) => `${p.name} (${formatDays(p.days, locale)})`).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatDays(w.days, locale)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtEUR(w.earned)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtEUR(w.paid)}</td>
                      <td className="px-3 py-2.5 text-right" style={w.owed > 0 ? DANGER : undefined}>
                        {fmtEUR(w.owed)}
                      </td>
                    </tr>
                  ))
                : result.projects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onOpenProject(p.id)}
                      className="cursor-pointer border-b tabular-nums hover:bg-black/[0.03]"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <td className="px-3 py-2.5 text-left">
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
                          {t("workerCount", { count: p.workerCount })}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatDays(p.days, locale)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtEUR(p.earned)}</td>
                      <td className="px-3 py-2.5 text-right">{fmtEUR(p.paid)}</td>
                      <td className="px-3 py-2.5 text-right" style={p.owed > 0 ? DANGER : undefined}>
                        {fmtEUR(p.owed)}
                      </td>
                    </tr>
                  ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold tabular-nums" style={{ background: "rgba(0,0,0,0.03)" }}>
                <td className="px-3 py-3 text-left">{t("total")}</td>
                <td className="px-3 py-3 text-right">{formatDays(totals.days, locale)}</td>
                <td className="px-3 py-3 text-right">{fmtEUR(totals.earned)}</td>
                <td className="px-3 py-3 text-right">{fmtEUR(totals.paid)}</td>
                <td className="px-3 py-3 text-right">
                  {fmtEUR(view === "workers" ? totals.owed : result.projects.reduce((s, p) => s + p.owed, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
        {t("laborFootnote")}
        {data.failed > 0 && ` ${t("laborPartial", { count: data.failed })}`}
      </p>
    </>
  );
}
