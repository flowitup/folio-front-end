"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { WorkerList } from "@/components/labor/worker-list";
import { AddWorkerDialog } from "@/components/labor/add-worker-dialog";
import { AttendanceTable } from "@/components/labor/attendance-table";
import { AttendanceCalendar } from "@/components/labor/attendance-calendar";
import { ViewToggle, type AttendanceViewMode } from "@/components/labor/view-toggle";
import { LogDayDialog } from "@/components/labor/log-day-dialog";
import { EditAttendanceDialog } from "@/components/labor/edit-attendance-dialog";
import { LaborSummary } from "@/components/labor/labor-summary";

import { ActivityDialog } from "@/components/labor/activity-dialog";

import type { Worker, LaborEntry, LaborActivity, LaborSummaryResponse, LaborMonthlySummaryResponse, CreateWorkerPayload, UpdateWorkerPayload, UpdateAttendancePayload, CreateLaborActivityPayload } from "@/types/labor";
import type { LaborRole } from "@/types/labor-role";
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  fetchLaborEntries,
  updateAttendance,
  deleteAttendance,
  fetchLaborSummary,
  fetchLaborMonthlySummary,
  fetchLaborActivities,
  createLaborActivity,
  updateLaborActivity,
  deleteLaborActivity,
} from "@/lib/api/labor";
import { fetchLaborRolesAction } from "./actions";

type TabType = "workers" | "attendance" | "summary";

function monthToRange(month: string) {
  if (!month) return { from: undefined, to: undefined };
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { from: undefined, to: undefined };
  const [, y, m] = match.map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default function LaborPage() {
  const t = useTranslations("labor");
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Permission check
  const canManageLabor = user?.permissions?.some(
    (p) => p === "project:manage_labor" || p === "*:*" || p === "project:*"
  ) ?? false;

  // State
  const [activeTab, setActiveTab] = useState<TabType>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workers state
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);

  // Roles state
  const [roles, setRoles] = useState<LaborRole[]>([]);
  const [palette, setPalette] = useState<string[]>([]);

  // Worker lookup map for role-aware chip colors in calendar cells.
  const workerMap = useMemo(
    () => Object.fromEntries(workers.map((w) => [w.id, w])),
    [workers],
  );

  // Entries state
  const [entries, setEntries] = useState<LaborEntry[]>([]);
  const [showLogDay, setShowLogDay] = useState(false);
  // Date pre-fill for the bulk-log dialog (YYYY-MM-DD). Set when the
  // user clicks an empty calendar cell or "Log more" inside the sheet.
  const [logDayDate, setLogDayDate] = useState<string | undefined>(undefined);
  // Active entry for the edit dialog. Null when closed.
  const [editEntry, setEditEntry] = useState<LaborEntry | null>(null);
  // Activities state.
  const [activities, setActivities] = useState<LaborActivity[]>([]);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [activityDate, setActivityDate] = useState<string | undefined>(undefined);
  const [editActivity, setEditActivity] = useState<LaborActivity | null>(null);
  // Default: "" → no month filter → all-history view (BE caps the response,
  // see GET /labor-entries default limit). The month picker is opt-in.
  const [entriesMonth, setEntriesMonth] = useState("");
  const [entriesWorkerFilter, setEntriesWorkerFilter] = useState("all");
  // Calendar default per plan; list view stays available as fallback for
  // power users who want "all history" scroll (cook 2d).
  const [attendanceView, setAttendanceView] = useState<AttendanceViewMode>(
    "calendar",
  );

  // Summary state. Default: "" → unbounded (all history). The month picker
  // is opt-in; clearing it returns to the all-history aggregate. Mirrors the
  // attendance default (PR #44). When summaryMonth is empty we render the
  // per-month rollup (monthlySummary); when set we render the existing
  // per-worker breakdown (summary).
  const [summary, setSummary] = useState<LaborSummaryResponse | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<LaborMonthlySummaryResponse | null>(null);
  const [summaryMonth, setSummaryMonth] = useState("");

  // Load workers
  const loadWorkers = useCallback(async () => {
    try {
      const data = await fetchWorkers(projectId);
      setWorkers(data);
    } catch {
      setError("Failed to load workers");
    }
  }, [projectId]);

  // Load entries.
  // entriesMonth === "" means "all history" — fetch unbounded (BE caps the
  // response). When a month is picked, narrow with from/to.
  const loadEntries = useCallback(async () => {
    setIsTabLoading(true);
    try {
      const { from, to } = monthToRange(entriesMonth);
      const data = await fetchLaborEntries(projectId, {
        from,
        to,
        worker_id: entriesWorkerFilter !== "all" ? entriesWorkerFilter : undefined,
      });
      setEntries(data);
    } catch {
      setError("Failed to load entries");
    } finally {
      setIsTabLoading(false);
    }
  }, [projectId, entriesMonth, entriesWorkerFilter]);

  const loadActivities = useCallback(async () => {
    try {
      const { from, to } = monthToRange(entriesMonth);
      const data = await fetchLaborActivities(projectId, { from, to });
      setActivities(data);
    } catch {
      // Non-fatal: activities are enhancement; entries still render.
    }
  }, [projectId, entriesMonth]);

  // Load summary.
  // - summaryMonth === ""  → fetch the per-month rollup (LaborSummary
  //   renders month rows + year filter buttons).
  // - summaryMonth !== "" → fetch the per-worker summary scoped to that
  //   month (existing behavior).
  const loadSummary = useCallback(async () => {
    setIsTabLoading(true);
    try {
      if (summaryMonth === "") {
        const data = await fetchLaborMonthlySummary(projectId);
        setMonthlySummary(data);
      } else {
        const { from, to } = monthToRange(summaryMonth);
        const data = await fetchLaborSummary(projectId, { from, to });
        setSummary(data);
      }
    } catch {
      setError("Failed to load summary");
    } finally {
      setIsTabLoading(false);
    }
  }, [projectId, summaryMonth]);

  // Initial load — workers + roles in parallel.
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([
        loadWorkers(),
        fetchLaborRolesAction().then((result) => {
          if (result.success) {
            setRoles(result.data.roles);
            setPalette(result.data.palette);
          }
          // Non-fatal: roles are enhancement only; missing roles doesn't
          // prevent the page from loading.
        }),
      ]);
      setIsLoading(false);
    };
    load();
  }, [loadWorkers]);

  useEffect(() => {
    if (activeTab === "attendance") {
      loadEntries();
      loadActivities();
    }
  }, [activeTab, loadEntries, loadActivities]);

  useEffect(() => {
    if (activeTab === "summary") loadSummary();
  }, [activeTab, loadSummary]);

  // Topbar "+ Log day" hands off via ?logDay=1 — jump to the attendance tab
  // and open the bulk-log dialog. Strip the param after consuming.
  useEffect(() => {
    if (searchParams.get("logDay") !== "1") return;
    setActiveTab("attendance");
    setLogDayDate(undefined);
    setShowLogDay(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("logDay");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Handlers
  const handleCreateWorker = async (payload: CreateWorkerPayload | UpdateWorkerPayload) => {
    try {
      await createWorker(projectId, payload as CreateWorkerPayload);
      await loadWorkers();
    } catch {
      setError("Failed to create worker");
    }
  };

  const handleUpdateWorker = async (payload: CreateWorkerPayload | UpdateWorkerPayload) => {
    if (editWorker) {
      try {
        await updateWorker(projectId, editWorker.id, payload as UpdateWorkerPayload);
        await loadWorkers();
        setEditWorker(null);
      } catch {
        setError("Failed to update worker");
      }
    }
  };

  const handleDeactivateWorker = async (worker: Worker) => {
    try {
      await deleteWorker(projectId, worker.id);
      await loadWorkers();
    } catch {
      setError("Failed to deactivate worker");
    }
  };

  const handleUpdateAttendance = async (payload: UpdateAttendancePayload) => {
    if (!editEntry) return;
    try {
      await updateAttendance(projectId, editEntry.id, payload);
      await loadEntries();
      setEditEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
      throw err;
    }
  };

  const handleOpenLogDay = (date?: string) => {
    setLogDayDate(date);
    setShowLogDay(true);
  };

  const handleDeleteEntry = async (entry: LaborEntry) => {
    try {
      await deleteAttendance(projectId, entry.id);
      await loadEntries();
    } catch {
      setError("Failed to delete entry");
    }
  };

  const handleOpenAddActivity = (date: string) => {
    setActivityDate(date);
    setEditActivity(null);
    setShowActivityDialog(true);
  };

  const handleOpenEditActivity = (activity: LaborActivity) => {
    setEditActivity(activity);
    setActivityDate(undefined);
    setShowActivityDialog(true);
  };

  const handleSaveActivity = async (data: { date: string; title: string; description?: string }) => {
    if (editActivity) {
      await updateLaborActivity(projectId, editActivity.id, {
        title: data.title,
        description: data.description,
      });
    } else {
      await createLaborActivity(projectId, data as CreateLaborActivityPayload);
    }
    await loadActivities();
  };

  const handleDeleteActivity = async (activity: LaborActivity) => {
    try {
      await deleteLaborActivity(projectId, activity.id);
      await loadActivities();
    } catch {
      setError(t("activity.deleteFailed"));
    }
  };

  return (
    <div className="fade-up flex min-h-full flex-col gap-4 px-4 pb-12 lg:gap-6 lg:px-8">
      {/* Segmented tabs */}
      <div className="flex items-center">
        <div className="seg w-full sm:w-auto">
          {(["summary", "attendance", "workers"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "on" : ""}
            >
              {t(tab)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {/* Tab Content */}
      {!isLoading && activeTab === "workers" && (
        <WorkerList
          workers={workers}
          canManage={canManageLabor}
          projectId={projectId}
          onAdd={() => setShowAddWorker(true)}
          onEdit={(worker) => setEditWorker(worker)}
          onDeactivate={handleDeactivateWorker}
        />
      )}

      {!isLoading && activeTab === "attendance" && (
        <div
          className={
            attendanceView === "calendar"
              ? "flex flex-col gap-4 lg:min-h-0 lg:flex-1"
              : "flex flex-col gap-4"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ViewToggle value={attendanceView} onChange={setAttendanceView} />
            {canManageLabor && (
              <Button onClick={() => handleOpenLogDay()}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("logDay")}</span>
              </Button>
            )}
          </div>
          {attendanceView === "calendar" ? (
            <AttendanceCalendar
              entries={entries}
              workers={workers}
              activities={activities}
              isLoading={isTabLoading}
              canManage={canManageLabor}
              month={entriesMonth}
              workerFilter={entriesWorkerFilter}
              onMonthChange={setEntriesMonth}
              onWorkerFilterChange={setEntriesWorkerFilter}
              onDelete={handleDeleteEntry}
              onLogDay={canManageLabor ? handleOpenLogDay : undefined}
              onEditEntry={canManageLabor ? setEditEntry : undefined}
              workerMap={workerMap}
              onAddActivity={canManageLabor ? handleOpenAddActivity : undefined}
              onEditActivity={canManageLabor ? handleOpenEditActivity : undefined}
              onDeleteActivity={canManageLabor ? handleDeleteActivity : undefined}
            />
          ) : (
            <AttendanceTable
              entries={entries}
              workers={workers}
              activities={activities}
              isLoading={isTabLoading}
              canManage={canManageLabor}
              month={entriesMonth}
              workerFilter={entriesWorkerFilter}
              onMonthChange={setEntriesMonth}
              onWorkerFilterChange={setEntriesWorkerFilter}
              onDelete={handleDeleteEntry}
              onAddActivity={canManageLabor ? handleOpenAddActivity : undefined}
              onEditActivity={canManageLabor ? handleOpenEditActivity : undefined}
              onDeleteActivity={canManageLabor ? handleDeleteActivity : undefined}
            />
          )}
        </div>
      )}

      {!isLoading && activeTab === "summary" && (
        <LaborSummary
          projectId={projectId}
          summary={summary}
          monthlySummary={monthlySummary}
          workers={workers}
          isLoading={isTabLoading}
          month={summaryMonth}
          onMonthChange={setSummaryMonth}
        />
      )}

      {/* Dialogs */}
      <AddWorkerDialog
        open={showAddWorker}
        onOpenChange={setShowAddWorker}
        onSave={handleCreateWorker}
        roles={roles}
        palette={palette}
        onRoleCreated={(role) => setRoles((prev) => [...prev, role])}
      />

      <AddWorkerDialog
        open={!!editWorker}
        onOpenChange={(open) => !open && setEditWorker(null)}
        onSave={handleUpdateWorker}
        editWorker={editWorker}
        roles={roles}
        palette={palette}
        onRoleCreated={(role) => setRoles((prev) => [...prev, role])}
      />

      <LogDayDialog
        open={showLogDay}
        onOpenChange={(open) => {
          setShowLogDay(open);
          if (!open) setLogDayDate(undefined);
        }}
        projectId={projectId}
        workers={workers}
        entries={entries}
        initialDate={logDayDate}
        onSaved={loadEntries}
      />

      <EditAttendanceDialog
        open={editEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditEntry(null);
        }}
        entry={editEntry}
        onSave={handleUpdateAttendance}
      />

      <ActivityDialog
        open={showActivityDialog}
        onOpenChange={(open) => {
          setShowActivityDialog(open);
          if (!open) {
            setEditActivity(null);
            setActivityDate(undefined);
          }
        }}
        initialDate={activityDate}
        editActivity={editActivity}
        onSave={handleSaveActivity}
      />
    </div>
  );
}
