"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { fetchTasks } from "@/lib/api/task-api";
import type { Invoice } from "@/types/invoice";
import type { Task } from "@/types/task";
import {
  EXPENSE_TYPES,
  computeSpentTotal,
  buildMonthlySpendSeries,
  computeMonthDelta,
  computeBudgetMetrics,
  computePendingRefunds,
  buildPurseViews,
  buildTypeMonthlyBuckets,
  type MonthDelta,
  type MonthlySpendPoint,
  type TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import { OverviewMoneyPanel } from "@/components/dashboard/overview-money-panel";
import { OverviewTypeMinis } from "@/components/dashboard/overview-type-minis";
import { OverviewAgenda } from "@/components/dashboard/overview-agenda";
import { OverviewWeatherCard } from "@/components/dashboard/overview-weather-card";

const MONTHS_BACK = 6;

interface OverviewMeta {
  fundsReleasedTotal: number;
  fundsReleasedCompanyTotal?: number;
  fundsReleasedPersonalTotal?: number;
  companySpentTotal: number;
  personalSpentTotal: number;
}

const EMPTY_META: OverviewMeta = {
  fundsReleasedTotal: 0,
  companySpentTotal: 0,
  personalSpentTotal: 0,
};
const EMPTY_INVOICES: Invoice[] = [];
const EMPTY_TASKS: Task[] = [];
const EMPTY_MONTHLY_SERIES: MonthlySpendPoint[] = [];
const EMPTY_MONTH_DELTA: MonthDelta = {
  current: { key: "", total: 0, count: 0 },
  previous: null,
  deltaPct: null,
};
// Same shape buildTypeMonthlyBuckets would return, minus any date-derived
// content — used before the reference date is mount-set (see M1 below).
const EMPTY_TYPE_BUCKETS: TypeMonthlyBucket[] = EXPENSE_TYPES.map((type) => ({
  type,
  monthly: [],
  total: 0,
  count: 0,
  deltaPct: null,
}));

export default function DashboardPage() {
  const { selectedProject } = useProject();
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const projectId = selectedProject?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<OverviewMeta>(EMPTY_META);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Reference "now" for month labels / agenda-week math is resolved once on
  // mount instead of at render time: this component is SSR-prerendered, and
  // calling `new Date()` directly in the render path would bake the server's
  // clock into the initial HTML — a client rendering a different local month
  // (timezone offset around a month boundary) then hydrates a text mismatch
  // (React #418). Staying `null` pre-mount keeps the first client paint
  // identical to the server output (both render the date-free empty state).
  const [referenceDate, setReferenceDate] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only value: must render after mount to avoid SSR clock mismatch
    setReferenceDate(new Date());
  }, []);

  useEffect(() => {
    // `loaded` doesn't need resetting here: showLoading below is already
    // gated on `projectId` being set, so a stale `loaded=true` from a
    // previous project is harmless once no project is selected.
    if (!projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading/error state ahead of the fetch this effect kicks off for the (possibly new) projectId; the fetch is the "external system" being synchronized.
    setLoaded(false);
    setError(null);
    (async () => {
      try {
        const [invoiceRes, taskRes] = await Promise.all([
          fetchInvoicesWithMeta(projectId),
          fetchTasks(projectId),
        ]);
        if (cancelled) return;
        setInvoices(invoiceRes.invoices);
        setMeta({
          fundsReleasedTotal: invoiceRes.funds_released_total ?? 0,
          fundsReleasedCompanyTotal: invoiceRes.funds_released_company_total,
          fundsReleasedPersonalTotal: invoiceRes.funds_released_personal_total,
          companySpentTotal: invoiceRes.company_spent_total ?? 0,
          personalSpentTotal: invoiceRes.personal_spent_total ?? 0,
        });
        setTasks(taskRes);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        setError(t("loadError"));
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  // Overview is reachable with no selected project. Mask any previously
  // fetched data instead of resetting it from an effect (which would cause a
  // cascading render) — the underlying state is refetched anyway the moment
  // a project becomes selected.
  const activeInvoices = useMemo(
    () => (projectId ? invoices : EMPTY_INVOICES),
    [projectId, invoices]
  );
  const activeMeta = useMemo(() => (projectId ? meta : EMPTY_META), [projectId, meta]);
  const activeTasks = useMemo(() => (projectId ? tasks : EMPTY_TASKS), [projectId, tasks]);
  const showLoading = Boolean(projectId) && !loaded;

  const spentTotal = useMemo(() => computeSpentTotal(activeInvoices), [activeInvoices]);
  const monthlySeries = useMemo(
    () =>
      referenceDate ? buildMonthlySpendSeries(activeInvoices, MONTHS_BACK, referenceDate) : EMPTY_MONTHLY_SERIES,
    [activeInvoices, referenceDate]
  );
  const monthDelta = useMemo(
    () => (monthlySeries.length > 0 ? computeMonthDelta(monthlySeries) : EMPTY_MONTH_DELTA),
    [monthlySeries]
  );
  const budgetMetrics = useMemo(
    () => computeBudgetMetrics(selectedProject?.budget, spentTotal, activeMeta.fundsReleasedTotal),
    [selectedProject?.budget, spentTotal, activeMeta.fundsReleasedTotal]
  );
  const pendingRefunds = useMemo(() => computePendingRefunds(activeInvoices), [activeInvoices]);
  const purses = useMemo(() => buildPurseViews(activeInvoices, activeMeta), [activeInvoices, activeMeta]);
  const typeBuckets = useMemo(
    () =>
      referenceDate ? buildTypeMonthlyBuckets(activeInvoices, MONTHS_BACK, referenceDate) : EMPTY_TYPE_BUCKETS,
    [activeInvoices, referenceDate]
  );
  const agendaGroups = useMemo(
    () => (referenceDate ? groupAgendaTasks(activeTasks, referenceDate) : []),
    [activeTasks, referenceDate]
  );

  const viewExpenseHref = projectId ? `/${locale}/projects/${projectId}/invoices` : null;
  const planningHref = projectId ? `/${locale}/projects/${projectId}/planning` : null;

  return (
    <div className="fade-up space-y-5 px-4 pb-12 lg:px-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <OverviewMoneyPanel
        spentTotal={spentTotal}
        budgetMetrics={budgetMetrics}
        monthlySeries={monthlySeries}
        monthDelta={monthDelta}
        pendingRefunds={pendingRefunds}
        purses={purses}
        loading={showLoading}
      />

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <OverviewTypeMinis buckets={typeBuckets} viewExpenseHref={viewExpenseHref} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <OverviewAgenda groups={agendaGroups} planningHref={planningHref} />
          <OverviewWeatherCard />
        </div>
      </div>
    </div>
  );
}
