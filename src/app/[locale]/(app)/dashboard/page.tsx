"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { fetchTasks } from "@/lib/api/task-api";
import type { Invoice } from "@/types/invoice";
import type { Task } from "@/types/task";
import {
  computeSpentTotal,
  buildMonthlySpendSeries,
  computeMonthDelta,
  computeBudgetMetrics,
  computePendingRefunds,
  buildPurseViews,
  buildTypeMonthlyBuckets,
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

export default function DashboardPage() {
  const { selectedProject } = useProject();
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const projectId = selectedProject?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<OverviewMeta>(EMPTY_META);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const [invoiceRes, taskRes] = await Promise.all([
        fetchInvoicesWithMeta(projectId),
        fetchTasks(projectId),
      ]);
      setInvoices(invoiceRes.invoices);
      setMeta({
        fundsReleasedTotal: invoiceRes.funds_released_total ?? 0,
        fundsReleasedCompanyTotal: invoiceRes.funds_released_company_total,
        fundsReleasedPersonalTotal: invoiceRes.funds_released_personal_total,
        companySpentTotal: invoiceRes.company_spent_total ?? 0,
        personalSpentTotal: invoiceRes.personal_spent_total ?? 0,
      });
      setTasks(taskRes);
    } catch {
      setError(t("loadError"));
    }
  }, [projectId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch is conditional on a selected project; Overview is reachable with none selected.
    loadOverview();
  }, [loadOverview]);

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

  const spentTotal = useMemo(() => computeSpentTotal(activeInvoices), [activeInvoices]);
  const monthlySeries = useMemo(
    () => buildMonthlySpendSeries(activeInvoices, MONTHS_BACK),
    [activeInvoices]
  );
  const monthDelta = useMemo(() => computeMonthDelta(monthlySeries), [monthlySeries]);
  const budgetMetrics = useMemo(
    () => computeBudgetMetrics(selectedProject?.budget, spentTotal, activeMeta.fundsReleasedTotal),
    [selectedProject?.budget, spentTotal, activeMeta.fundsReleasedTotal]
  );
  const pendingRefunds = useMemo(() => computePendingRefunds(activeInvoices), [activeInvoices]);
  const purses = useMemo(() => buildPurseViews(activeInvoices, activeMeta), [activeInvoices, activeMeta]);
  const typeBuckets = useMemo(
    () => buildTypeMonthlyBuckets(activeInvoices, MONTHS_BACK),
    [activeInvoices]
  );
  const agendaGroups = useMemo(() => groupAgendaTasks(activeTasks), [activeTasks]);

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
