"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useProject } from "@/context/ProjectContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
  computeBankOutstanding,
  buildPurseViews,
  computeUnassignedSpend,
  buildTypeMonthlyBuckets,
  type MonthDelta,
  type MonthlySpendPoint,
  type TypeMonthlyBucket,
} from "@/lib/dashboard/overview-metrics";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import { OverviewMoneyPanel } from "@/components/dashboard/overview-money-panel";
import { OverviewTypeMinis } from "@/components/dashboard/overview-type-minis";
import { OverviewAgenda } from "@/components/dashboard/overview-agenda";
import { BankReleaseChart } from "@/components/project/bank-release-chart";
import Link from "next/link";
import { ArrowRight, Building2, Clock, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { can, canCreateProject } from "@/lib/auth/permissions";

const MONTHS_BACK = 6;

interface OverviewMeta {
  fundsReleasedTotal: number;
  fundsReleasedCompanyTotal?: number;
  fundsReleasedPersonalTotal?: number;
  companySpentTotal: number;
  personalSpentTotal: number;
  /** Company money handed to a person (cash-advance releases); 0 on older BE. */
  companyCashAdvancedTotal?: number;
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
  current: { key: "", total: 0, count: 0, credited: 0, creditCount: 0 },
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
  const { selectedProject, isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = useProject();
  const { user } = useAuth();
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const tProjects = useTranslations("projects");
  const projectId = selectedProject?.id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<OverviewMeta>(EMPTY_META);
  const [tasks, setTasks] = useState<Task[]>([]);
  // The expenses and the tasks load independently: a failed task fetch must
  // not throw away expenses that loaded fine, and a failed expense fetch must
  // not leave the money panels computing "full budget left" from nothing.
  const [invoicesStatus, setInvoicesStatus] = useState<"loading" | "ok" | "error">("loading");
  const [tasksFailed, setTasksFailed] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);

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
    // The status doesn't need resetting when no project is selected:
    // showLoading below is gated on `projectId`.
    if (!projectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading/error state ahead of the fetches this effect kicks off for the (possibly new) projectId; the fetch is the "external system" being synchronized.
    setInvoicesStatus("loading");
    setTasksFailed(false);
    setTasksLoading(true);
    fetchInvoicesWithMeta(projectId)
      .then((invoiceRes) => {
        if (cancelled) return;
        setInvoices(invoiceRes.invoices);
        setMeta({
          fundsReleasedTotal: invoiceRes.funds_released_total ?? 0,
          fundsReleasedCompanyTotal: invoiceRes.funds_released_company_total,
          fundsReleasedPersonalTotal: invoiceRes.funds_released_personal_total,
          companySpentTotal: invoiceRes.company_spent_total ?? 0,
          personalSpentTotal: invoiceRes.personal_spent_total ?? 0,
          companyCashAdvancedTotal: invoiceRes.company_cash_advanced_total ?? 0,
        });
        setInvoicesStatus("ok");
      })
      .catch(() => {
        if (cancelled) return;
        // Drop the previous project's figures; the panels show "—".
        setInvoices(EMPTY_INVOICES);
        setMeta(EMPTY_META);
        setInvoicesStatus("error");
      });
    fetchTasks(projectId)
      .then((taskRes) => {
        if (cancelled) return;
        setTasks(taskRes);
        setTasksLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTasks(EMPTY_TASKS);
        setTasksFailed(true);
        setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const error = projectId && (invoicesStatus === "error" || tasksFailed) ? t("loadError") : null;
  // No expense data to show: while loading, and after a failed load.
  const moneyUnavailable = Boolean(projectId) && invoicesStatus !== "ok";

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
  const showLoading = moneyUnavailable;

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
  // With a credit set, remaining = credit − funds released. Without one it is the funds
  // released minus every purse's spend (company incl. cash advanced, plus personal).
  const purseSpent =
    activeMeta.companySpentTotal + (activeMeta.companyCashAdvancedTotal ?? 0) + activeMeta.personalSpentTotal;
  const budgetMetrics = useMemo(
    () => computeBudgetMetrics(selectedProject?.budget, purseSpent, activeMeta.fundsReleasedTotal),
    [selectedProject?.budget, purseSpent, activeMeta.fundsReleasedTotal]
  );
  const pendingRefunds = useMemo(() => computePendingRefunds(activeInvoices), [activeInvoices]);
  const bankOutstanding = useMemo(() => computeBankOutstanding(activeInvoices), [activeInvoices]);
  const purses = useMemo(() => buildPurseViews(activeInvoices, activeMeta), [activeInvoices, activeMeta]);
  const unassigned = useMemo(() => computeUnassignedSpend(activeInvoices), [activeInvoices]);
  const typeBuckets = useMemo(
    () =>
      referenceDate ? buildTypeMonthlyBuckets(activeInvoices, MONTHS_BACK, referenceDate) : EMPTY_TYPE_BUCKETS,
    [activeInvoices, referenceDate]
  );
  const agendaGroups = useMemo(
    () => (referenceDate ? groupAgendaTasks(activeTasks, referenceDate) : []),
    [activeTasks, referenceDate]
  );

  // Financing side of the project. Without `project:view_budget` the backend
  // already withholds the budget and zeroes every released-funds total, so the
  // draw-down chart and the budget-relative parts of the money panel are hidden
  // rather than drawn against zeros.
  const canViewBudget = can("project:view_budget", user?.permissions, selectedProject?.my_permissions);
  // A member without labor, pay or invoice rights gets only their own labor
  // payments from the API, with the project totals zeroed. Drawn under
  // "Spent" / "Spent this month" / "Monthly spend by type" those read as the
  // project's spending, so a member sees a pointer to their own pay instead
  // (the labor page draws the same line).
  const seesProjectMoney =
    can("project:manage_labor", user?.permissions, selectedProject?.my_permissions) ||
    can("project:view_pay", user?.permissions, selectedProject?.my_permissions) ||
    can("project:manage_invoices", user?.permissions, selectedProject?.my_permissions);
  const showMemberNote = Boolean(projectId) && !seesProjectMoney;

  const viewExpenseHref = projectId ? `/${locale}/projects/${projectId}/invoices` : null;
  const planningHref = projectId ? `/${locale}/projects/${projectId}/planning` : null;
  const projectSettingsHref = projectId ? `/${locale}/projects/${projectId}/settings` : null;
  const laborHref = projectId ? `/${locale}/projects/${projectId}/labor` : null;

  // The project list failed to load: say so with a retry, rather than the
  // "create your first project" state an account with projects must not see.
  if (!projectsLoading && !selectedProject && projectsError) {
    return (
      <div className="fade-up px-4 pb-12 lg:px-8">
        <Alert variant="destructive" data-testid="overview-projects-error">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{tProjects("loadError")}</span>
            <Button variant="outline" size="sm" onClick={() => void refetchProjects()}>
              {tProjects("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No project at all: a money dashboard of zeros would read as real figures,
  // so point to creating one (or, without that right, say one is coming).
  if (!projectsLoading && !selectedProject) {
    const canCreate = canCreateProject(user?.permissions, user?.companies);
    return (
      <div className="fade-up px-4 pb-12 lg:px-8">
        <div
          className="folio-card flex flex-col items-center justify-center py-16 text-center"
          data-testid="overview-no-project"
        >
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            {canCreate ? (
              <Building2 size={36} style={{ color: "var(--muted)" }} />
            ) : (
              <Clock size={36} style={{ color: "var(--muted)" }} />
            )}
          </div>
          <h2 className="font-display text-[20px] font-medium tracking-tight">
            {canCreate ? tProjects("noProjectsYet") : tProjects("waitingForAssignment.title")}
          </h2>
          <p className="mt-1 max-w-sm text-[13px]" style={{ color: "var(--muted)" }}>
            {canCreate ? tProjects("getStarted") : tProjects("waitingForAssignment.description")}
          </p>
          {canCreate && (
            <Link href={`/${locale}/projects?new=1`} className="btn btn-primary mt-4">
              <Plus size={14} />
              {tProjects("createFirst")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-5 px-4 pb-12 lg:px-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!showMemberNote && (
        <OverviewMoneyPanel
          spentTotal={spentTotal}
          budgetMetrics={budgetMetrics}
          monthlySeries={monthlySeries}
          monthDelta={monthDelta}
          pendingRefunds={pendingRefunds}
          bankOutstanding={bankOutstanding}
          purses={purses}
          unassigned={unassigned}
          loading={showLoading}
          canViewBudget={canViewBudget}
          settingsHref={projectSettingsHref}
        />
      )}

      {canViewBudget && (
        <BankReleaseChart
          credit={selectedProject?.budget}
          releasedTotal={activeMeta.fundsReleasedTotal}
          invoices={activeInvoices}
          settingsHref={projectSettingsHref}
          loading={showLoading}
        />
      )}

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          {showMemberNote ? (
            <div className="folio-card p-6" data-testid="overview-member-finances">
              <h2 className="font-display text-[18px] font-semibold tracking-tight">
                {t("memberFinances.title")}
              </h2>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
                {t("memberFinances.body")}
              </p>
              {laborHref && (
                <Link href={laborHref} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium">
                  {t("memberFinances.link")} <ArrowRight size={12} />
                </Link>
              )}
            </div>
          ) : (
            <OverviewTypeMinis
              buckets={moneyUnavailable ? EMPTY_TYPE_BUCKETS : typeBuckets}
              viewExpenseHref={viewExpenseHref}
              unavailable={moneyUnavailable}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <OverviewAgenda
            groups={agendaGroups}
            planningHref={planningHref}
            loading={Boolean(projectId) && tasksLoading}
          />
        </div>
      </div>
    </div>
  );
}
