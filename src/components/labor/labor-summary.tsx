"use client";

import { useMemo, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Calendar, ChevronRight, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LaborSummaryResponse,
  LaborMonthlySummaryResponse,
  LaborPaymentsSummaryResponse,
  LaborPaymentsMonthBucket,
  MonthlySummaryRow,
  Worker,
} from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";
import { LaborExportDialog } from "@/components/labor/labor-export-dialog";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";
import { DEFAULT_ROLE_I18N_KEYS } from "@/lib/utils/default-role-names";
import { findMonthBucket } from "@/components/labor/labor-payments-tab-state";
import { PaidSplitCaption } from "@/components/labor/paid-split-caption";

interface LaborSummaryProps {
  projectId: string;
  summary: LaborSummaryResponse | null;
  /** Per-month rollup. Used when no specific month filter is active. */
  monthlySummary: LaborMonthlySummaryResponse | null;
  /** Project workers — used to display each worker's true `daily_rate`
   *  in the per-worker sub-rows. Optional so the legacy two-prop call
   *  site (and tests) still type-check; sub-rows fall back to omitting
   *  the rate when this is empty. */
  workers?: Worker[];
  /** Count of workers with an entry dated today (local date). Computed by
   *  the page from a today-scoped summary fetch so it stays correct in both
   *  the all-history and single-month views. */
  onSiteToday?: number;
  /** Recorded-payments rollup (labor invoices), used to derive the Paid
   *  column in both table modes and Balance in single-month mode. Optional
   *  so legacy call sites/tests that don't share this fetch still render —
   *  Paid falls back to "—" and Balance to the full Total everywhere. */
  paymentsSummary?: LaborPaymentsSummaryResponse | null;
  isLoading: boolean;
  month: string;
  onMonthChange: (value: string) => void;
}

/** Format a (year, month) into a compact label like "Nov 2025".
 *  Compact (3-letter month) keeps each ledger row a single line even on
 *  narrow viewports — matches the editorial Folio mock. */
function formatYearMonthLabel(row: MonthlySummaryRow, locale: string): string {
  const d = new Date(row.year, row.month - 1, 1);
  return capitalizeFirst(
    d.toLocaleDateString(locale, { month: "short", year: "numeric" }),
    locale,
  );
}

function formatMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** Format bonus_days value: render integer without decimal, float with one decimal */
function formatBonusDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Format a fractional priced-day count compactly: "5" for 5.0, "5.5"
 *  for 5.5, "5.25" for 5.25. Strips trailing zeros after the dot so a
 *  whole-day total doesn't show a redundant decimal. */
function formatDays(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  // Render with up to 2 fraction digits, then trim trailing zeros.
  return value.toFixed(2).replace(/\.?0+$/, "");
}

// Folio warm worker-accent palette, lifted from the Labor Summary
// design. Used to tint the per-worker avatar + the inline MiniBar so a
// reader can scan "who carried the cost" without reading the numbers.
const WORKER_PALETTE = ["#b96523", "#5a7a4a", "#c98e2b", "#8a5836", "#714c3e"];

function workerColor(workerId: string): string {
  let hash = 0;
  for (let i = 0; i < workerId.length; i += 1) {
    hash = (hash * 31 + workerId.charCodeAt(i)) >>> 0;
  }
  return WORKER_PALETTE[hash % WORKER_PALETTE.length];
}

function workerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/** Inline horizontal bar — used for "scan the rhythm" per-row cost bar. */
function MiniBar({
  value,
  max,
  color = "var(--accent)",
  width = 96,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  width?: number;
  height?: number;
}) {
  const w = Math.max(2, (value / (max || 1)) * width);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <rect x="0" y="0" width={width} height={height} rx={height / 2} fill="var(--line)" />
      <rect x="0" y="0" width={w} height={height} rx={height / 2} fill={color} />
    </svg>
  );
}

export function LaborSummary({
  projectId,
  summary,
  monthlySummary,
  workers,
  onSiteToday = 0,
  paymentsSummary,
  isLoading,
  month,
  onMonthChange,
}: LaborSummaryProps) {
  const t = useTranslations("labor");
  const tRole = useTranslations("labor.role.defaults");
  const locale = useLocale();
  const [exportOpen, setExportOpen] = useState(false);
  // Year filter — null = "All years". Only meaningful when month filter
  // is unset (we're in the all-history monthly-rollup view).
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  // Ref to the hidden native <input type="month">. The Folio-styled
  // trigger button calls showPicker() on it so users get the native OS
  // month picker without the browser UA chrome.
  const monthInputRef = useRef<HTMLInputElement>(null);

  // month === "" → unbounded "all history" summary. Switch labels + headers
  // to a localized "All history" string and hide the Clear button.
  const isAllHistory = month === "";
  const periodLabel = isAllHistory
    ? t("filterMonthAll")
    : formatMonthLabel(month, locale);

  // Year filter buttons — derived from the per-month rollup so we only
  // show years that actually have data. DESC.
  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    monthlySummary?.rows.forEach((r) => ys.add(r.year));
    return Array.from(ys).sort((a, b) => b - a);
  }, [monthlySummary]);

  // Filtered monthly rows (apply year filter if one is selected).
  const filteredMonthlyRows = useMemo(() => {
    const rows = monthlySummary?.rows ?? [];
    return selectedYear == null ? rows : rows.filter((r) => r.year === selectedYear);
  }, [monthlySummary, selectedYear]);

  // Max cost across visible month rows — drives MiniBar width so each
  // row's bar reads as a fraction of the busiest month.
  const maxMonthCost = useMemo(() => {
    return filteredMonthlyRows.reduce((m, r) => Math.max(m, r.total_cost), 1);
  }, [filteredMonthlyRows]);

  // Distinct worker count across the visible months — drives the grand
  // total row's "N workers" caption in all-history mode (where the
  // single-month per-worker `summary` is null).
  const distinctWorkerCount = useMemo(() => {
    const ids = new Set<string>();
    filteredMonthlyRows.forEach((r) => r.workers.forEach((w) => ids.add(w.worker_id)));
    return ids.size;
  }, [filteredMonthlyRows]);

  // Lookup table: worker_id → Worker. We must NOT derive the rate from
  // total_cost / days_worked — that blends full days, half days, and
  // overrides into a misleading "effective" rate. The contract shown to
  // users is the worker's configured rate: current_daily_rate (post
  // rate-change, matches the Workers tab tiles) falling back to the base
  // daily_rate for older API responses.
  const workerById = useMemo(() => {
    const m = new Map<string, Worker>();
    for (const w of workers ?? []) m.set(w.id, w);
    return m;
  }, [workers]);

  // Per-month expand/collapse state. Default: all months open so the
  // table reads as a complete ledger on first load — the chevron lets
  // the user collapse what they don't need.
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());
  // Seed openMonths with every visible key on first non-empty render —
  // and reseed only when the visible set genuinely changes (e.g. year
  // filter narrows the rows). Storing the last-seeded signature in
  // state (not a ref) lets us safely call setState during render: React
  // discards this render and re-runs with the new state. See the
  // "Storing information from previous renders" pattern in the React
  // docs for useState.
  const [seededKeys, setSeededKeys] = useState<string>("");
  const visibleKeys = filteredMonthlyRows
    .map((r) => `${r.year}-${String(r.month).padStart(2, "0")}`)
    .join("|");
  if (visibleKeys && visibleKeys !== seededKeys) {
    setSeededKeys(visibleKeys);
    setOpenMonths(new Set(visibleKeys.split("|")));
  }
  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // KPI numbers: in all-history mode they roll up the monthly buckets
  // (filtered by year if set). In month mode they come from the per-worker
  // summary (existing behavior).
  const totalCost = isAllHistory
    ? filteredMonthlyRows.reduce((sum, r) => sum + r.total_cost, 0)
    : summary?.total_cost ?? 0;
  const totalDays = isAllHistory
    ? filteredMonthlyRows.reduce((sum, r) => sum + r.total_days, 0)
    : summary?.total_days ?? 0;
  // "across N workers" caption: distinct workers over the visible months in
  // all-history mode; the month's worker rows when a month is selected.
  const workerCount = isAllHistory ? distinctWorkerCount : summary?.rows.length ?? 0;

  const totalBankedHours = summary?.total_banked_hours ?? 0;
  const totalBonusDays = summary?.total_bonus_days ?? 0;
  const totalBonusCost = summary?.total_bonus_cost ?? 0;

  // ── Paid/Balance lookups (labor-payments-summary) ──────────────────────
  // Single-month mode: the one bucket matching the viewed month (or null
  // when nothing has been paid that month yet, or the fetch wasn't shared).
  const monthBucket = useMemo(
    () => findMonthBucket(paymentsSummary ?? null, month),
    [paymentsSummary, month],
  );
  const paidByWorkerId = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of monthBucket?.workers ?? []) m.set(w.worker_id, w.paid);
    return m;
  }, [monthBucket]);
  // Grand-total Paid/Balance for the single-month footer — summed from the
  // same per-worker matches as the rows above (NOT the bucket's total_paid,
  // which also folds in unassigned payments that aren't attributable to any
  // row here — see the all-history rule below for where that belongs).
  const footerPaid = useMemo(() => {
    if (!summary) return 0;
    return summary.rows.reduce((sum, r) => sum + (paidByWorkerId.get(r.worker_id) ?? 0), 0);
  }, [summary, paidByWorkerId]);
  const footerBalance = (summary?.total_cost ?? 0) - footerPaid;

  // All-history mode: every bucket keyed by "yyyy-mm" so each visible month
  // header/sub-row can look up its own Paid figure in O(1).
  const bucketByMonthKey = useMemo(() => {
    const m = new Map<string, LaborPaymentsMonthBucket>();
    for (const b of paymentsSummary?.months ?? []) {
      if (b.year != null && b.month != null) {
        m.set(`${b.year}-${String(b.month).padStart(2, "0")}`, b);
      }
    }
    return m;
  }, [paymentsSummary]);
  // Month-header Paid = bucket.total_paid, which already folds in
  // assigned + unassigned payments for that month (the money that actually
  // left). Deliberately no Balance column in this mode: recorded payments
  // aren't tracked per bonus day, so subtracting Paid from this table's
  // bonus-inclusive Total would produce a figure that doesn't reconcile —
  // Balance only appears in single-month mode, where both sides are scoped
  // to the same worker+month.
  const totalPaidAllHistory = useMemo(() => {
    return filteredMonthlyRows.reduce((sum, r) => {
      const ym = `${r.year}-${String(r.month).padStart(2, "0")}`;
      return sum + (bucketByMonthKey.get(ym)?.total_paid ?? 0);
    }, 0);
  }, [filteredMonthlyRows, bucketByMonthKey]);
  // Company/personal split of totalPaidAllHistory — same visible-month scope,
  // so the footer caption always reconciles with the rows above it.
  const totalSplitAllHistory = useMemo(() => {
    return filteredMonthlyRows.reduce(
      (acc, r) => {
        const ym = `${r.year}-${String(r.month).padStart(2, "0")}`;
        const bucket = bucketByMonthKey.get(ym);
        acc.company += bucket?.company_paid ?? 0;
        acc.personal += bucket?.personal_paid ?? 0;
        return acc;
      },
      { company: 0, personal: 0 },
    );
  }, [filteredMonthlyRows, bucketByMonthKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Supplement banner — only shown when there are banked hours */}
      {totalBankedHours > 0 && (
        <div className="rounded-lg bg-[var(--warning-tint)] p-4">
          <p className="text-[13px] font-medium">
            {t("supplement.banner", {
              banked: totalBankedHours,
              bonusDays: formatBonusDays(totalBonusDays),
              bonusCost: formatEUR(totalBonusCost),
            })}
          </p>
        </div>
      )}

      {/* KPI Row — 3 base cards + bonus-cost card */}
      {/* KPI grid — total labor cost leads as a full-width hero on mobile, the
          rest sit in a compact 2-up grid so the summary isn't a tall stack. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <div className="folio-card col-span-2 p-5 lg:col-span-1">
          <div className="label-cap">{t("totalLaborCost")}</div>
          <div className="font-display num mt-2 text-[28px] font-medium leading-none">
            {formatEUR(totalCost)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--positive)" }}>
            {periodLabel}
          </div>
        </div>
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("workerDays")}</div>
          <div className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]">
            {formatDays(totalDays)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("acrossWorkers", { n: workerCount })}
          </div>
        </div>
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("onSiteToday")}</div>
          <div className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]">
            {onSiteToday}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("workersLogged")}
          </div>
        </div>
        {/* Bonus cost KPI — always rendered to keep grid stable; value is 0 when no supplements */}
        <div className="folio-card p-4 lg:p-5">
          <div className="label-cap">{t("supplement.bonusCost")}</div>
          <div
            className="font-display num mt-2 text-[22px] font-medium leading-none lg:text-[28px]"
            style={{ color: "var(--accent)" }}
          >
            {formatEUR(totalBonusCost)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("supplement.bonusDaysSubtitle", { days: formatBonusDays(totalBonusDays) })}
          </div>
        </div>
      </div>

      {/* Year filter — only shown when no specific month filter is active.
          Buttons derived from the data; horizontal scroll on overflow so
          mobile stays clean even when there are many years. */}
      {isAllHistory && availableYears.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="year-filter-row">
          <button
            type="button"
            onClick={() => setSelectedYear(null)}
            className={`stamp num shrink-0 ${selectedYear == null ? "on" : ""}`}
            aria-pressed={selectedYear == null}
          >
            {t("summaryAllYears")}
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`stamp num shrink-0 ${selectedYear === y ? "on" : ""}`}
              aria-pressed={selectedYear === y}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Summary table */}
      <div className="folio-card overflow-hidden">
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[18px] font-medium tracking-tight">
              {isAllHistory
                ? selectedYear == null
                  ? t("summaryAllHistoryTitle")
                  : t("summaryYearTitle", { year: selectedYear })
                : t("monthlySummary", { month: periodLabel })}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="folio-month-picker"
                onClick={() => {
                  const el = monthInputRef.current;
                  if (!el) return;
                  // showPicker() is preferred (Chrome/Safari/FF modern). Focus
                  // is the fallback when the API isn't available — at minimum
                  // the user can type a value.
                  if (typeof el.showPicker === "function") {
                    el.showPicker();
                  } else {
                    el.focus();
                  }
                }}
                aria-label={t("filterMonth")}
              >
                <Calendar size={14} aria-hidden="true" />
                <span className="num">
                  {isAllHistory ? t("summaryMonthPickerAll") : periodLabel}
                </span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{ color: "var(--muted)", marginLeft: 2 }}
                />
              </button>
              <input
                ref={monthInputRef}
                type="month"
                value={month}
                onChange={(e) => onMonthChange(e.target.value)}
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            </div>
            {!isAllHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMonthChange("")}
                aria-label={t("filterMonthClear")}
                title={t("filterMonthClear")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {workerCount > 0 && !isAllHistory && (
              <span className="stamp num">{t("workersBadge", { n: workerCount })}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              {t("export.button")}
            </Button>
          </div>
        </div>

        {/* Conditional body: month-grouped rows in all-history mode,
            per-worker table when a specific month is selected. */}
        {isAllHistory ? (
          filteredMonthlyRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {t("noEntries")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>{t("summaryMonthColumn")}</th>
                    <th>{t("summaryCrewColumn")}</th>
                    <th style={{ textAlign: "right" }}>{t("daysWorked")}</th>
                    <th>{t("summaryCostColumn")}</th>
                    <th style={{ textAlign: "right" }}>{t("totalCost")}</th>
                    <th style={{ textAlign: "right" }}>{t("payments.paid")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyRows.flatMap((row) => {
                    const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
                    const open = openMonths.has(ym);
                    const bucket = bucketByMonthKey.get(ym);
                    const monthPaid = bucket?.total_paid ?? 0;
                    const monthUnassignedCount = bucket?.unassigned_count ?? 0;
                    // Warn on CLOSED months whose charges aren't fully settled.
                    // The current month is excluded — being mid-month unpaid is
                    // normal, not a problem to flag. Compares against the same
                    // total this table displays; 1-cent epsilon absorbs rounding.
                    const now = new Date();
                    const isPastMonth = row.year < now.getFullYear() || (row.year === now.getFullYear() && row.month < now.getMonth() + 1);
                    const monthShortfall = row.total_cost - monthPaid;
                    const showUnpaidWarning = isPastMonth && monthShortfall > 0.01;
                    // Warn on ANY month whose recorded payments exceed its
                    // charges — unlike the unpaid case, overpaying is
                    // anomalous even mid-month, so the current month is not
                    // excluded. Same 1-cent epsilon as the shortfall check.
                    const monthOverpay = monthPaid - row.total_cost;
                    const showOverpaidWarning = monthOverpay > 0.01;
                    const rows: React.ReactNode[] = [
                      <tr
                        key={`row-${ym}`}
                        onClick={() => onMonthChange(ym)}
                        title={t("summaryDrillDown")}
                        data-testid={`month-row-${ym}`}
                        className="month-row"
                        style={{ cursor: "pointer" }}
                      >
                        {/* Chevron — toggles per-worker breakdown. Stops
                            propagation so the row click still drills the
                            user into the single-month view. */}
                        <td
                          style={{ paddingRight: 0, color: "var(--muted)", width: 32 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMonth(ym);
                          }}
                          aria-label={t("summaryToggleBreakdown")}
                          title={t("summaryToggleBreakdown")}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              transition: "transform 160ms ease",
                              transform: `rotate(${open ? 90 : 0}deg)`,
                              cursor: "pointer",
                            }}
                          >
                            <ChevronRight size={14} aria-hidden="true" />
                          </span>
                        </td>
                        <td className="font-display text-[14px] font-semibold tracking-tight">
                          {formatYearMonthLabel(row, locale)}
                          {showUnpaidWarning && (
                            <span
                              className="stamp warning num"
                              style={{ marginLeft: 8, verticalAlign: "middle" }}
                              title={t("summaryUnpaidWarningTitle")}
                              data-testid={`month-unpaid-warning-${ym}`}
                            >
                              {t("summaryUnpaidWarning", { amount: formatEUR(monthShortfall) })}
                            </span>
                          )}
                          {showOverpaidWarning && (
                            <span
                              className="stamp negative num"
                              style={{ marginLeft: 8, verticalAlign: "middle" }}
                              title={t("summaryOverpaidWarningTitle")}
                              data-testid={`month-overpaid-warning-${ym}`}
                            >
                              {t("summaryOverpaidWarning", { amount: formatEUR(monthOverpay) })}
                            </span>
                          )}
                        </td>
                        {/* Avatar stack + "N workers" caption. The stack
                            previews who was on site that month so a
                            collapsed row still tells a story. */}
                        <td>
                          <div style={{ display: "inline-flex", alignItems: "center" }}>
                            {row.workers.map((w, i) => (
                              <span
                                key={w.worker_id}
                                className="avatar"
                                title={`${w.worker_name} · ${formatDays(w.days_worked)}d · ${formatEUR(w.total_cost)}`}
                                style={{
                                  background: workerColor(w.worker_id),
                                  width: 22,
                                  height: 22,
                                  fontSize: 10,
                                  marginLeft: i ? -6 : 0,
                                  border: "2px solid var(--card-paper)",
                                }}
                              >
                                {workerInitials(w.worker_name)}
                              </span>
                            ))}
                            <span
                              className="num text-[11px]"
                              style={{ color: "var(--muted)", alignSelf: "center", marginLeft: 8 }}
                            >
                              {t("workersBadge", { n: row.workers.length })}
                            </span>
                          </div>
                        </td>
                        {/* Days cell intentionally blank on the month row
                            — per-worker day counts live in the sub-rows
                            below; the header is kept only to keep the
                            sub-row numbers aligned in this column. */}
                        <td />
                        <td>
                          <MiniBar value={row.total_cost} max={maxMonthCost} width={96} height={6} />
                        </td>
                        <td
                          className="num text-[13px] font-semibold tabular-nums"
                          style={{ textAlign: "right" }}
                        >
                          {formatEUR(row.total_cost)}
                        </td>
                        <td
                          className="num text-[13px] font-medium tabular-nums"
                          style={{ textAlign: "right" }}
                        >
                          {monthPaid > 0 ? (
                            formatEUR(monthPaid)
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                          {monthUnassignedCount > 0 && (
                            <span
                              className="num"
                              style={{ marginLeft: 6, fontSize: 10.5, color: "var(--muted)" }}
                            >
                              {t("summaryUnassignedHint", { n: monthUnassignedCount })}
                            </span>
                          )}
                          <PaidSplitCaption
                            company={bucket?.company_paid ?? 0}
                            personal={bucket?.personal_paid ?? 0}
                            testId={`month-paid-split-${ym}`}
                          />
                        </td>
                      </tr>,
                    ];
                    if (open) {
                      for (const w of row.workers) {
                        const color = workerColor(w.worker_id);
                        // True configured daily rate from the worker
                        // record — NOT total_cost / days_worked, which
                        // averages full + half + override shifts into
                        // a fractional value that doesn't match what
                        // the user actually pays per day. Prefer the
                        // current effective rate so this matches the
                        // Workers tab after a scheduled rate change.
                        const worker = workerById.get(w.worker_id);
                        const rate = worker ? worker.current_daily_rate ?? worker.daily_rate : undefined;
                        const workerPaid =
                          bucket?.workers.find((wb) => wb.worker_id === w.worker_id)?.paid ?? 0;
                        rows.push(
                          <tr
                            key={`sub-${ym}-${w.worker_id}`}
                            data-testid={`worker-subrow-${ym}-${w.worker_id}`}
                            style={{ background: "rgba(0,0,0,.015)" }}
                          >
                            <td />
                            <td
                              style={{
                                paddingLeft: 16,
                                position: "relative",
                                border: "none",
                                paddingTop: 6,
                                paddingBottom: 6,
                              }}
                            >
                              {/* Tinted left rail keys each subrow to its
                                  worker color so the avatar + bar + name
                                  read as one unit. */}
                              <span
                                aria-hidden="true"
                                style={{
                                  position: "absolute",
                                  left: 4,
                                  top: 0,
                                  bottom: 0,
                                  width: 2,
                                  background: color,
                                  opacity: 0.45,
                                }}
                              />
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span
                                  className="avatar"
                                  style={{ background: color, width: 20, height: 20, fontSize: 9.5 }}
                                >
                                  {workerInitials(w.worker_name)}
                                </span>
                                <div
                                  className="text-[12.5px]"
                                  style={{ color: "var(--ink-2)", lineHeight: 1.2 }}
                                >
                                  {w.worker_name}
                                </div>
                              </div>
                            </td>
                            <td
                              className="num text-[11.5px]"
                              style={{ color: "var(--muted)", border: "none", paddingTop: 6, paddingBottom: 6 }}
                            >
                              {rate != null && rate > 0
                                ? t("summaryPerDay", { rate: formatEUR(rate) })
                                : ""}
                            </td>
                            <td
                              className="num text-[12.5px] tabular-nums"
                              style={{ textAlign: "right", border: "none", paddingTop: 6, paddingBottom: 6 }}
                            >
                              {formatDays(w.days_worked)}
                            </td>
                            <td style={{ border: "none", paddingTop: 6, paddingBottom: 6 }}>
                              <MiniBar
                                value={w.total_cost}
                                max={maxMonthCost}
                                width={96}
                                height={4}
                                color={color}
                              />
                            </td>
                            <td
                              className="num text-[12.5px] font-medium tabular-nums"
                              style={{ textAlign: "right", border: "none", paddingTop: 6, paddingBottom: 6 }}
                            >
                              {formatEUR(w.total_cost)}
                            </td>
                            <td
                              className="num text-[12.5px] font-medium tabular-nums"
                              style={{ textAlign: "right", border: "none", paddingTop: 6, paddingBottom: 6 }}
                            >
                              {workerPaid > 0 ? (
                                formatEUR(workerPaid)
                              ) : (
                                <span style={{ color: "var(--muted)" }}>—</span>
                              )}
                            </td>
                          </tr>,
                        );
                      }
                    }
                    return rows;
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--paper-2)" }}>
                    <td />
                    <td className="font-medium">{t("grandTotal")}</td>
                    <td style={{ color: "var(--muted)" }}>
                      {t("workersBadge", { n: distinctWorkerCount })}
                    </td>
                    <td className="num font-medium" style={{ textAlign: "right" }}>
                      {formatDays(totalDays)}
                    </td>
                    <td />
                    <td
                      className="num font-medium tabular-nums"
                      style={{ textAlign: "right", color: "var(--accent-ink)" }}
                    >
                      {formatEUR(totalCost)}
                    </td>
                    <td
                      className="num font-medium tabular-nums"
                      style={{ textAlign: "right" }}
                    >
                      {totalPaidAllHistory > 0 ? formatEUR(totalPaidAllHistory) : "—"}
                      <PaidSplitCaption
                        company={totalSplitAllHistory.company}
                        personal={totalSplitAllHistory.personal}
                        testId="all-history-paid-split"
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        ) : !summary || summary.rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noEntries")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>{t("workerName")}</th>
                  <th>{t("role.label")}</th>
                  <th style={{ textAlign: "right" }}>{t("daysWorked")}</th>
                  <th style={{ textAlign: "right" }}>{t("totalCost")}</th>
                  <th style={{ textAlign: "right" }}>{t("payments.paid")}</th>
                  <th style={{ textAlign: "right" }}>{t("payments.balance")}</th>
                  <th style={{ textAlign: "right" }}>{t("supplement.bonusDays")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => {
                  const initials = row.worker_name
                    .split(" ")
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  // Role comes from the workers list (summary rows carry
                  // only id + name). Default seed roles resolve through
                  // the locale map, custom roles display their DB name.
                  const rowWorker = workerById.get(row.worker_id);
                  const roleName = rowWorker?.role_id && DEFAULT_ROLE_I18N_KEYS[rowWorker.role_id]
                    ? tRole(DEFAULT_ROLE_I18N_KEYS[rowWorker.role_id])
                    : rowWorker?.role_name;
                  // Paid matched by worker_id within the viewed month's
                  // bucket; Balance is this row's already-rendered Total
                  // minus Paid — never recompute the cost side.
                  const rowPaid = paidByWorkerId.get(row.worker_id) ?? 0;
                  const rowBalance = row.total_cost - rowPaid;
                  return (
                    <tr key={row.worker_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">{initials}</div>
                          <span>{row.worker_name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{roleName ?? "—"}</td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {formatDays(row.days_worked)}
                      </td>
                      <td className="num font-medium" style={{ textAlign: "right" }}>
                        {formatEUR(row.total_cost)}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {rowPaid > 0 ? (
                          formatEUR(rowPaid)
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                      {/* Negative balance = this worker was paid more than the
                          month's charge — tint it as an overpay so it can't be
                          misread as money still owed. */}
                      <td
                        className="num font-medium"
                        style={{
                          textAlign: "right",
                          ...(rowBalance < -0.01
                            ? { color: "var(--negative)" }
                            : {}),
                        }}
                        title={rowBalance < -0.01 ? t("summaryOverpaidWarningTitle") : undefined}
                        data-testid={rowBalance < -0.01 ? `worker-overpaid-${row.worker_id}` : undefined}
                      >
                        {formatEUR(rowBalance)}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {row.banked_hours > 0 ? (
                          <div className="flex flex-col items-end">
                            <span>{row.bonus_full_days}F + {row.bonus_half_days}H</span>
                            <span className="text-xs text-muted-foreground">
                              {row.banked_hours}h · {formatEUR(row.bonus_cost)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--paper-2)" }}>
                  <td colSpan={2} className="font-medium">
                    {t("grandTotal")}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {formatDays(summary.total_days)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                    {formatEUR(summary.total_cost)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {footerPaid > 0 ? formatEUR(footerPaid) : "—"}
                  </td>
                  <td
                    className="num font-medium"
                    style={{
                      textAlign: "right",
                      color: footerBalance < -0.01 ? "var(--negative)" : "var(--accent-ink)",
                    }}
                    title={footerBalance < -0.01 ? t("summaryOverpaidWarningTitle") : undefined}
                    data-testid={footerBalance < -0.01 ? "footer-overpaid" : undefined}
                  >
                    {formatEUR(footerBalance)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                    {totalBonusCost > 0 ? formatEUR(totalBonusCost) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <LaborExportDialog
        projectId={projectId}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </div>
  );
}
