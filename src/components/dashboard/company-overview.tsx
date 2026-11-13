"use client";

/**
 * Company view of the Overview (design "B5"): an ink band with the company's
 * money and labor figures, one card per project ordered by what needs
 * attention, and a right rail with alerts and the wages still owed per worker.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { Project } from "@/types/project";
import { fetchLaborMonthlySummary, fetchLaborPaymentsSummary } from "@/lib/api/labor";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { fmtEUR } from "@/lib/projects/budget-display";
import { formatShare } from "@/lib/utils/format-percent";
import { formatDays } from "@/components/labor/format-days";
import { parisDayKey } from "@/lib/utils/paris-day";
import { companyLabor, laborMonths, type ProjectLaborInput } from "@/lib/projects/company-labor";
import {
  attentionItems,
  companyProjectCards,
  companyTotals,
  initials,
  type ProjectStatus,
} from "@/lib/dashboard/company-overview";
import { OverviewScopeToggle, type OverviewScope } from "@/components/dashboard/overview-scope-toggle";

/** Projects loaded at a time: two requests each, well under the API's per-minute limit. */
const BATCH = 4;
const WORKERS_SHOWN = 8;
const BAND_MUTED = "#cfc8ba";
const BAND_TINT = "rgba(245,241,234,0.08)";
const BAND_TRACK = "rgba(245,241,234,0.16)";
const OWED_ON_DARK = "#f1c8a3";

const STATUS_STYLE: Record<ProjectStatus, { bg: string; fg: string; dot: string }> = {
  over: { bg: "var(--negative-tint)", fg: "#8a3a26", dot: "var(--negative)" },
  near: { bg: "var(--warning-tint)", fg: "#6e4c10", dot: "var(--warning)" },
  ok: { bg: "var(--positive-tint)", fg: "#3d5531", dot: "var(--positive)" },
  noBudget: { bg: "var(--paper-2)", fg: "var(--ink-2)", dot: "var(--muted-2)" },
  hidden: { bg: "var(--paper-2)", fg: "var(--ink-2)", dot: "var(--muted-2)" },
};

async function loadLabor(projects: readonly Project[]): Promise<{ inputs: ProjectLaborInput[]; failed: number }> {
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

export interface CompanyOverviewProps {
  projects: readonly Project[];
  companies: { id: string; name: string }[];
  companyId: string | null;
  onCompanyChange: (id: string) => void;
  onScopeChange: (s: OverviewScope) => void;
  onOpenProject: (id: string) => void;
}

export function CompanyOverview({ projects, companies, companyId, onCompanyChange, onScopeChange, onOpenProject }: CompanyOverviewProps) {
  const t = useTranslations("dashboard.company");
  const locale = useLocale();
  const [labor, setLabor] = useState<{ inputs: ProjectLaborInput[]; failed: number } | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [allWorkers, setAllWorkers] = useState(false);
  const ids = projects.map((p) => p.id).join(",");

  useEffect(() => {
    let cancelled = false;
    setLabor(null);
    void loadLabor(projects).then((d) => {
      if (!cancelled) setLabor(d);
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the project ids: the list object changes on every silent refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const months = useMemo(() => (labor ? laborMonths(labor.inputs) : []), [labor]);
  // Default: this month (Paris calendar), else the latest month with attendance or payments.
  const thisMonth = parisDayKey().slice(0, 7);
  const activeMonth = month ?? (months.includes(thisMonth) ? thisMonth : (months[0] ?? thisMonth));
  const monthOptions = months.includes(activeMonth) ? months : [activeMonth, ...months];
  const laborResult = useMemo(() => (labor ? companyLabor(labor.inputs, activeMonth) : null), [labor, activeMonth]);

  const cards = useMemo(() => companyProjectCards(projects, laborResult, projectDisplayName), [projects, laborResult]);
  const totals = useMemo(() => companyTotals(cards), [cards]);
  const alerts = useMemo(() => attentionItems(cards, laborResult, projectDisplayName), [cards, laborResult]);
  const workers = useMemo(
    () => [...(laborResult?.workers ?? [])].filter((w) => w.owed > 0).sort((a, b) => b.owed - a.owed),
    [laborResult],
  );
  const maxOwed = workers[0]?.owed ?? 0;
  const personalProjects = cards.filter((c) => (c.row.personal ?? 0) > 0).length;
  const hasBudget = totals.budget > 0;
  const companyName = companies.find((c) => c.id === companyId)?.name ?? "";

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  };
  const laborValue = (fn: () => string) => (laborResult ? fn() : "…");

  const kpis = [
    { label: t("spent"), value: fmtEUR(totals.spent), sub: t("spentSub"), color: "var(--paper)" },
    {
      label: t("days"),
      value: laborValue(() => formatDays(laborResult!.totals.days, locale)),
      sub: laborResult ? `${t("workerCount", { count: laborResult.totals.workerCount })} · ${monthLabel(activeMonth)}` : "",
      color: "var(--paper)",
    },
    {
      label: t("wagesOwed"),
      value: laborValue(() => fmtEUR(laborResult!.totals.owed)),
      sub: laborResult ? t("wagesPaid", { amount: fmtEUR(laborResult.totals.paid) }) : "",
      color: OWED_ON_DARK,
    },
    { label: t("personal"), value: fmtEUR(totals.personal), sub: t("projectCount", { count: personalProjects }), color: "var(--paper)" },
  ];

  const selectStyle = { background: "var(--paper-2)", color: "var(--ink)" };

  return (
    <div className="fade-up space-y-5 px-4 pb-12 lg:px-8" data-testid="company-overview">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{companyName || t("title")}</h2>
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("projectCountShort", { count: projects.length })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <OverviewScopeToggle scope="company" onChange={onScopeChange} />
          {companies.length > 1 && (
            <select
              aria-label={t("company")}
              value={companyId ?? ""}
              onChange={(e) => onCompanyChange(e.target.value)}
              className="min-h-[48px] rounded-[14px] border-0 px-3.5 text-[13.5px] font-medium"
              style={selectStyle}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label={t("month")}
            value={activeMonth}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-[48px] rounded-[14px] border-0 px-3.5 text-[13.5px] font-medium"
            style={selectStyle}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        className="flex flex-wrap items-center gap-7 rounded-[22px] px-6 py-6 sm:px-7"
        style={{ background: "var(--ink)", color: "var(--paper)" }}
        data-testid="company-overview-band"
      >
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
          <span className="text-[13px]" style={{ color: BAND_MUTED }}>
            {hasBudget ? t("remaining") : t("spent")}
          </span>
          <span className="font-display text-[44px] font-semibold leading-none tracking-tight tabular-nums sm:text-[52px]">
            {fmtEUR(hasBudget ? totals.remaining : totals.spent)}
          </span>
          {hasBudget && totals.usedPct !== null && (
            <>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: BAND_TRACK }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, totals.usedPct))}%`, background: totals.remaining < 0 ? "#e8a58a" : "var(--accent)" }}
                />
              </div>
              <span className="text-[12.5px]" style={{ color: BAND_MUTED }}>
                {t("used", { pct: formatShare(locale, totals.usedPct), budget: fmtEUR(totals.budget) })}
                {totals.overBudgetCount > 0 && ` · ${t("overCount", { count: totals.overBudgetCount })}`}
              </span>
            </>
          )}
        </div>
        <div className="grid min-w-0 flex-[2_1_420px] grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="flex flex-col gap-1.5 rounded-2xl px-4 py-3.5" style={{ background: BAND_TINT }}>
              <span className="text-[12.5px]" style={{ color: BAND_MUTED }}>
                {k.label}
              </span>
              <span className="font-display text-[22px] font-semibold leading-tight tabular-nums" style={{ color: k.color }}>
                {k.value}
              </span>
              <span className="text-[12px]" style={{ color: BAND_MUTED }}>
                {k.sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[20px] font-semibold tracking-tight">{t("projectCountShort", { count: cards.length })}</h2>
            <span className="text-[13px]" style={{ color: "var(--muted)" }}>
              {t("attentionFirst")}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
            {cards.map((c) => {
              const st = STATUS_STYLE[c.status];
              const r = c.row;
              const pct = r.usedPct === null ? null : Math.max(0, Math.min(100, r.usedPct));
              return (
                <button
                  key={r.project.id}
                  type="button"
                  onClick={() => onOpenProject(r.project.id)}
                  className="flex flex-col gap-3.5 rounded-[20px] p-[18px] text-left transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--card-paper)", boxShadow: "0 1px 0 rgba(26,26,26,0.02), 0 12px 28px -18px rgba(26,26,26,0.22)" }}
                  data-testid="company-project-card"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="text-[15px] font-semibold">{projectDisplayName(r.project)}</span>
                    <span className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: st.bg, color: st.fg }}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                      {t(`status.${c.status}`)}
                    </span>
                  </div>
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-[26px] font-semibold leading-none tabular-nums" style={{ color: c.status === "over" ? "var(--negative)" : "var(--ink)" }}>
                        {r.remaining !== null ? fmtEUR(r.remaining) : r.spent !== null ? fmtEUR(r.spent) : "—"}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                        {r.remaining !== null ? t("left") : t("spentShort")}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: st.dot }} />
                      </div>
                    )}
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {r.budget !== null && r.spent !== null && r.usedPct !== null
                        ? t("spentOf", { spent: fmtEUR(r.spent), budget: fmtEUR(r.budget), pct: formatShare(locale, r.usedPct) })
                        : r.spent !== null
                          ? t("noBudgetLine")
                          : t("hiddenLine")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12.5px] tabular-nums">
                    <span className="rounded-full px-2.5 py-1.5" style={{ background: "var(--paper)", color: "var(--ink-2)" }}>
                      {laborResult ? t("daysChip", { days: formatDays(c.days, locale) }) : "…"}
                    </span>
                    {laborResult && (
                      <span
                        className="rounded-full px-2.5 py-1.5 font-medium"
                        style={c.owed > 0 ? { background: "var(--negative-tint)", color: "#8a3a26" } : { background: "var(--positive-tint)", color: "#3d5531" }}
                      >
                        {c.owed > 0 ? t("owedChip", { amount: fmtEUR(c.owed) }) : c.days > 0 ? t("paidChip") : t("noDaysChip")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section className="flex flex-col gap-1 rounded-[20px] p-5" style={{ background: "var(--accent-tint)" }} data-testid="company-attention">
            <h2 className="mb-2 font-display text-[20px] font-semibold tracking-tight">{t("attention")}</h2>
            {alerts.length === 0 ? (
              <p className="text-[13px]" style={{ color: "#5c4630" }}>
                {t("attentionNone")}
              </p>
            ) : (
              alerts.map((a) => (
                <div key={a.kind === "unassignedPay" ? "unassigned" : `${a.kind}-${a.projectId}`} className="flex gap-2.5 border-t py-2.5" style={{ borderColor: "rgba(163,90,31,0.25)" }}>
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: a.kind === "over" ? "var(--negative)" : "var(--accent-ink)" }} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-medium">
                      {a.kind === "over"
                        ? t("alertOver", { name: a.name, amount: fmtEUR(a.amount) })
                        : a.kind === "near"
                          ? t("alertNear", { name: a.name, amount: fmtEUR(a.amount) })
                          : t("alertUnassigned", { amount: fmtEUR(a.amount) })}
                    </span>
                    <span className="text-[12.5px]" style={{ color: "#5c4630" }}>
                      {a.kind === "unassignedPay" ? t("alertUnassignedSub", { month: monthLabel(activeMonth) }) : t("alertPct", { pct: a.pct })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </section>

          <section
            className="flex flex-col gap-1 rounded-[20px] p-5"
            style={{ background: "var(--card-paper)", boxShadow: "0 1px 0 rgba(26,26,26,0.02), 0 12px 28px -18px rgba(26,26,26,0.22)" }}
            data-testid="company-wages"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[20px] font-semibold tracking-tight">{t("wagesTitle")}</h2>
              {laborResult && (
                <span className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--negative)" }}>
                  {fmtEUR(laborResult.totals.owed)}
                </span>
              )}
            </div>
            {!laborResult ? (
              <div className="flex items-center gap-2 py-4 text-[13px]" style={{ color: "var(--muted)" }}>
                <Loader2 className="h-4 w-4 animate-spin" /> {t("loadingLabor")}
              </div>
            ) : workers.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                {t("wagesNone")}
              </p>
            ) : (
              <>
                {(allWorkers ? workers : workers.slice(0, WORKERS_SHOWN)).map((w) => (
                  <div key={w.key} className="flex items-center gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12.5px] font-semibold"
                      style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
                    >
                      {initials(w.name)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex justify-between gap-2 text-[13.5px]">
                        <span className="truncate font-medium" title={w.projects.map((p) => p.name).join(", ")}>
                          {w.name}
                        </span>
                        <span className="tabular-nums">{fmtEUR(w.owed)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${maxOwed > 0 ? (w.owed / maxOwed) * 100 : 0}%`, background: "var(--accent)" }} />
                        </div>
                        <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--muted)" }}>
                          {t("daysChip", { days: formatDays(w.days, locale) })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {workers.length > WORKERS_SHOWN && (
                  <button type="button" onClick={() => setAllWorkers((v) => !v)} className="mt-1 self-start text-[12.5px] font-medium" style={{ color: "var(--accent-ink)" }}>
                    {allWorkers ? t("showLess") : t("showAll", { count: workers.length })}
                  </button>
                )}
              </>
            )}
          </section>
        </aside>
      </div>

      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        {t("footnote")}
        {labor && labor.failed > 0 && ` ${t("partial", { count: labor.failed })}`}
      </p>
    </div>
  );
}
