"use client";

/**
 * Charts on the company view of the Overview: spend by type over the last six
 * months across every project of the company (the project view's small
 * multiples, added up), labor month by month (days, wages earned and paid),
 * and — with two projects or more — spent against budget per project.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Project } from "@/types/project";
import type { Invoice } from "@/types/invoice";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { buildTypeMonthlyBuckets, EXPENSE_TYPES, monthKeyToDate, type TypeMonthlyBucket } from "@/lib/dashboard/overview-metrics";
import { companyLabor, type ProjectLaborInput } from "@/lib/projects/company-labor";
import type { CompanyProjectCard } from "@/lib/dashboard/company-overview";
import { OverviewTypeMinis } from "@/components/dashboard/overview-type-minis";
import { useDataTip } from "@/components/invoices/data-tip";
import { formatDays } from "@/components/labor/format-days";
import { fmtEUR } from "@/lib/projects/budget-display";
import { formatEURCompact } from "@/lib/utils/formatters";
import { parisDayKey } from "@/lib/utils/paris-day";
import { projectDisplayName } from "@/lib/projects/project-display-name";

const MONTHS = 6;
/** Projects loaded at a time, like the labor roll-up. */
const BATCH = 4;
const CARD_STYLE = { background: "var(--card-paper)", boxShadow: "0 1px 0 rgba(26,26,26,0.02), 0 12px 28px -18px rgba(26,26,26,0.22)" };

const EMPTY_BUCKETS: TypeMonthlyBucket[] = EXPENSE_TYPES.map((type) => ({ type, monthly: [], total: 0, count: 0, deltaPct: null }));

async function loadInvoices(projects: readonly Project[]): Promise<{ invoices: Invoice[]; failed: number }> {
  const invoices: Invoice[] = [];
  let failed = 0;
  for (let i = 0; i < projects.length; i += BATCH) {
    const settled = await Promise.allSettled(projects.slice(i, i + BATCH).map((p) => fetchInvoicesWithMeta(p.id)));
    for (const s of settled) {
      if (s.status === "fulfilled") invoices.push(...s.value.invoices);
      else failed += 1;
    }
  }
  return { invoices, failed };
}

/** The last `n` "YYYY-MM" keys ending at `thisMonth`, oldest first. */
export function lastMonths(thisMonth: string, n: number): string[] {
  const [y, m] = thisMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface LaborMonthPoint {
  key: string;
  days: number;
  earned: number;
  paid: number;
}

/** Days, wages earned and wages paid to workers, per month, company-wide. */
export function laborSeries(inputs: readonly ProjectLaborInput[], months: readonly string[]): LaborMonthPoint[] {
  return months.map((key) => {
    const l = companyLabor(inputs, key);
    return { key, days: l.totals.days, earned: l.totals.earned, paid: Math.round((l.totals.paid - l.totals.unassignedPaid) * 100) / 100 };
  });
}

interface Props {
  projects: readonly Project[];
  /** Per-project labor data already loaded by the company view; null while it loads. */
  laborInputs: readonly ProjectLaborInput[] | null;
  cards: readonly CompanyProjectCard[];
}

export function CompanyCharts({ projects, laborInputs, cards }: Props) {
  const t = useTranslations("dashboard.company");
  const [spend, setSpend] = useState<{ invoices: Invoice[]; failed: number } | null>(null);
  const ids = projects.map((p) => p.id).join(",");
  const thisMonth = parisDayKey().slice(0, 7);

  useEffect(() => {
    let cancelled = false;
    setSpend(null);
    void loadInvoices(projects).then((d) => {
      if (!cancelled) setSpend(d);
    });
    return () => {
      cancelled = true;
    };
    // Keyed on the project ids: the list object changes on every silent refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const buckets = useMemo(() => {
    if (!spend) return EMPTY_BUCKETS;
    const [y, m] = thisMonth.split("-").map(Number);
    return buildTypeMonthlyBuckets(spend.invoices, MONTHS, new Date(y, m - 1, Number(parisDayKey().slice(8, 10))));
  }, [spend, thisMonth]);
  const months = useMemo(() => lastMonths(thisMonth, MONTHS), [thisMonth]);
  const labor = useMemo(() => (laborInputs ? laborSeries(laborInputs, months) : null), [laborInputs, months]);
  // Spend per project only says something once there are two to compare.
  const projectRows = cards.filter((c) => c.row.spent !== null);

  return (
    <section className="flex flex-col gap-5" data-testid="company-charts">
      <div>
        <OverviewTypeMinis buckets={buckets} viewExpenseHref={null} unavailable={!spend} />
        {spend && spend.failed > 0 && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("spendPartial", { count: spend.failed })}
          </p>
        )}
      </div>
      <div className={`grid gap-5 ${projectRows.length > 1 ? "lg:grid-cols-2" : ""}`}>
        <LaborMonthsChart points={labor} />
        {projectRows.length > 1 && <ProjectSpendChart cards={projectRows} />}
      </div>
    </section>
  );
}

const L_W = 360;
const L_H = 170;
const L_BASE = 140;
const L_PLOT = 105;

/** Wages earned (light) and paid (dark) per month, with the days above. */
function LaborMonthsChart({ points }: { points: LaborMonthPoint[] | null }) {
  const t = useTranslations("dashboard.company");
  const tDash = useTranslations("dashboard");
  const locale = useLocale();
  const { tipHandlers, overlay } = useDataTip();
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const monthYearFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const max = Math.max(1, ...(points ?? []).flatMap((p) => [p.earned, p.paid]));
  const step = L_W / MONTHS;
  const barW = 18;
  const h = (v: number) => (v > 0 ? Math.max((v / max) * L_PLOT, 2) : 0);
  const totalDays = (points ?? []).reduce((s, p) => s + p.days, 0);

  return (
    <div className="rounded-[20px] p-5" style={CARD_STYLE} data-testid="company-labor-chart" {...tipHandlers}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">{t("laborChartTitle")}</h2>
        {points && (
          <span className="text-[13px] tabular-nums" style={{ color: "var(--muted)" }}>
            {t("laborChartDays", { days: formatDays(totalDays, locale) })}
          </span>
        )}
      </div>
      <div className="mb-3 flex gap-4 text-[13px]" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--accent)", opacity: 0.45 }} />
          {t("laborEarned")}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--accent)" }} />
          {t("laborPaid")}
        </span>
      </div>
      {!points ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("loadingLabor")}
        </p>
      ) : (
        <svg viewBox={`0 0 ${L_W} ${L_H}`} className="block h-auto w-full" role="group" aria-label={t("laborChartTitle")}>
          <line x1={0} x2={L_W} y1={L_BASE} y2={L_BASE} stroke="var(--line)" strokeWidth={1} />
          {points.map((p, i) => {
            const cx = step * i + step / 2;
            const he = h(p.earned);
            const hp = h(p.paid);
            const top = L_BASE - Math.max(he, hp);
            const tip = `${monthYearFmt.format(monthKeyToDate(p.key))}|${t("laborEarned")}: ${fmtEUR(p.earned)} · ${t("laborPaid")}: ${fmtEUR(p.paid)}|${t("daysChip", { days: formatDays(p.days, locale) })}`;
            return (
              <g key={p.key} data-testid={`company-labor-month-${p.key}`}>
                <rect x={cx - barW - 1} y={L_BASE - he} width={barW} height={he} rx={2} fill="var(--accent)" opacity={0.45} />
                <rect x={cx + 1} y={L_BASE - hp} width={barW} height={hp} rx={2} fill="var(--accent)" />
                {p.days > 0 && (
                  <text x={cx} y={Math.max(top - 6, 10)} textAnchor="middle" fontSize={10} fill="var(--ink-2)">
                    {t("daysChip", { days: formatDays(p.days, locale) })}
                  </text>
                )}
                {p.earned > 0 && (
                  <text x={cx} y={L_BASE + 26} textAnchor="middle" fontSize={9} fill="var(--muted)">
                    {formatEURCompact(locale, p.earned)}
                  </text>
                )}
                <text x={cx} y={L_BASE + 14} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {tDash("spendByType.monthTick", { m: monthKeyToDate(p.key).getMonth() + 1, short: monthFmt.format(monthKeyToDate(p.key)) })}
                </text>
                <rect x={cx - step / 2} y={0} width={step} height={L_BASE} fill="transparent" data-tip={tip} />
              </g>
            );
          })}
        </svg>
      )}
      {overlay}
    </div>
  );
}

/** One bar per project: spent against its budget (or alone without one). */
function ProjectSpendChart({ cards }: { cards: readonly CompanyProjectCard[] }) {
  const t = useTranslations("dashboard.company");
  const rows = [...cards].sort((a, b) => (b.row.spent ?? 0) - (a.row.spent ?? 0));
  const max = Math.max(1, ...rows.map((c) => Math.max(c.row.spent ?? 0, c.row.budget ?? 0)));
  return (
    <div className="rounded-[20px] p-5" style={CARD_STYLE} data-testid="company-project-chart">
      <h2 className="mb-1 font-display text-[18px] font-semibold tracking-tight">{t("projectChartTitle")}</h2>
      <div className="mb-3 flex gap-4 text-[13px]" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--paper-2)" }} />
          {t("budgetShort")}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--ink-2)" }} />
          {t("spentShort")}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((c) => {
          const spent = c.row.spent ?? 0;
          const over = c.status === "over";
          return (
            <li key={c.row.project.id} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-[13.5px]">
                <span className="truncate font-medium">{projectDisplayName(c.row.project)}</span>
                <span className="flex-none tabular-nums" style={{ color: over ? "var(--negative)" : "var(--ink)" }}>
                  {fmtEUR(spent)}
                  {c.row.budget !== null && <span style={{ color: "var(--muted)" }}> / {fmtEUR(c.row.budget)}</span>}
                </span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: "transparent" }}>
                {c.row.budget !== null && (
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(c.row.budget / max) * 100}%`, background: "var(--paper-2)" }} />
                )}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(spent / max) * 100}%`, background: over ? "var(--negative)" : "var(--ink-2)" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
