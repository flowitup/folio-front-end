"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { WorkerList } from "@/components/labor/worker-list";
import { AddWorkerDialog } from "@/components/labor/add-worker-dialog";
import { AttendanceTable } from "@/components/labor/attendance-table";
import { LogAttendanceDialog } from "@/components/labor/log-attendance-dialog";
import { LaborSummary } from "@/components/labor/labor-summary";

import type { Worker, LaborEntry, LaborSummaryResponse, CreateWorkerPayload, UpdateWorkerPayload, LogAttendancePayload } from "@/types/labor";
import {
  fetchWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  fetchLaborEntries,
  logAttendance,
  deleteAttendance,
  fetchLaborSummary,
} from "@/lib/api/labor";

type TabType = "workers" | "attendance" | "summary";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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

  // Entries state
  const [entries, setEntries] = useState<LaborEntry[]>([]);
  const [showLogAttendance, setShowLogAttendance] = useState(false);
  // Default: "" → no month filter → all-history view (BE caps the response,
  // see GET /labor-entries default limit). The month picker is opt-in.
  const [entriesMonth, setEntriesMonth] = useState("");
  const [entriesWorkerFilter, setEntriesWorkerFilter] = useState("all");

  // Summary state
  const [summary, setSummary] = useState<LaborSummaryResponse | null>(null);
  const [summaryMonth, setSummaryMonth] = useState(currentMonth);

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

  // Load summary
  const loadSummary = useCallback(async () => {
    setIsTabLoading(true);
    try {
      const { from, to } = monthToRange(summaryMonth);
      if (!from || !to) { setIsTabLoading(false); return; }
      const data = await fetchLaborSummary(projectId, { from, to });
      setSummary(data);
    } catch {
      setError("Failed to load summary");
    } finally {
      setIsTabLoading(false);
    }
  }, [projectId, summaryMonth]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      await loadWorkers();
      setIsLoading(false);
    };
    load();
  }, [loadWorkers]);

  useEffect(() => {
    if (activeTab === "attendance") loadEntries();
  }, [activeTab, loadEntries]);

  useEffect(() => {
    if (activeTab === "summary") loadSummary();
  }, [activeTab, loadSummary]);

  // Topbar "+ Log day" hands off via ?logDay=1 — jump to the attendance tab
  // and open the LogAttendanceDialog. Strip the param after consuming.
  useEffect(() => {
    if (searchParams.get("logDay") !== "1") return;
    setActiveTab("attendance");
    setShowLogAttendance(true);
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

  const handleLogAttendance = async (payload: LogAttendancePayload) => {
    try {
      await logAttendance(projectId, payload);
      await loadEntries();
    } catch {
      setError("Failed to log attendance");
    }
  };

  const handleDeleteEntry = async (entry: LaborEntry) => {
    try {
      await deleteAttendance(projectId, entry.id);
      await loadEntries();
    } catch {
      setError("Failed to delete entry");
    }
  };

  return (
    <div className="fade-up space-y-6 px-8 pb-12">
      {/* Segmented tabs */}
      <div className="flex items-center justify-between">
        <div className="seg">
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
        <div className="space-y-4">
          {canManageLabor && (
            <div className="flex justify-end">
              <Button onClick={() => setShowLogAttendance(true)}>
                <Plus className="h-4 w-4" />
                {t("logAttendance")}
              </Button>
            </div>
          )}
          <AttendanceTable
            entries={entries}
            workers={workers}
            isLoading={isTabLoading}
            canManage={canManageLabor}
            month={entriesMonth}
            workerFilter={entriesWorkerFilter}
            onMonthChange={setEntriesMonth}
            onWorkerFilterChange={setEntriesWorkerFilter}
            onDelete={handleDeleteEntry}
          />
        </div>
      )}

      {!isLoading && activeTab === "summary" && (
        <LaborSummary
          projectId={projectId}
          summary={summary}
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
      />

      <AddWorkerDialog
        open={!!editWorker}
        onOpenChange={(open) => !open && setEditWorker(null)}
        onSave={handleUpdateWorker}
        editWorker={editWorker}
      />

      <LogAttendanceDialog
        open={showLogAttendance}
        onOpenChange={setShowLogAttendance}
        onSave={handleLogAttendance}
        workers={workers}
      />
    </div>
  );
}
