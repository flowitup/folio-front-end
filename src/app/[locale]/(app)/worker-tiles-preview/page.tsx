"use client";

/**
 * /worker-tiles-preview — Phase 3b harness.
 *
 * Standalone page hosting the WorkerTile + WorkerTileSection pair
 * against real Workers fetched from the first project that has any.
 * Verifies tile color identity matches the calendar, checked-state
 * shift dropdown, locked "already logged" state.
 *
 * Throwaway — once LogDayDialog (3c) lands and is wired into the
 * AttendanceCalendar's empty-cell click (3d), this route should be
 * deleted alongside the rest of the preview pages.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3b).
 */

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { WorkerTile } from "@/components/labor/worker-tile";
import { WorkerTileSection } from "@/components/labor/worker-tile-section";
import { api } from "@/lib/api/http";
import type { ShiftType, Worker } from "@/types/labor";

interface ProjectSummary {
  id: string;
  name: string;
}

interface TileState {
  checked: boolean;
  shiftType: ShiftType;
  expanded: boolean;
}

export default function WorkerTilesPreviewPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [state, setState] = useState<Record<string, TileState>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await api.get<{ projects: ProjectSummary[] }>("/projects");
      const projects = data.projects ?? [];
      for (const p of projects) {
        const ws = await api.get<{ workers: Worker[]; total: number }>(
          `/projects/${p.id}/workers`,
        );
        if (cancelled) return;
        if ((ws.total ?? 0) > 0) {
          setProject(p);
          setWorkers(ws.workers);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function getState(workerId: string): TileState {
    return state[workerId] ?? { checked: false, shiftType: "full", expanded: false };
  }

  function update(workerId: string, patch: Partial<TileState>) {
    setState((prev) => ({
      ...prev,
      [workerId]: { ...getState(workerId), ...patch },
    }));
  }

  // Demo: lock the first worker so reviewers can see the locked state
  // without needing real entries seeded for the day.
  const lockedWorkerId = workers[0]?.id;

  // Split first 3 = "Recent", rest = "All"
  const recent = workers.slice(0, 3);
  const rest = workers.slice(3);
  const checkedCount = Object.values(state).filter((s) => s.checked).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Worker tiles preview
        </h1>
        <p className="text-muted-foreground text-sm">
          Phase 3b harness — WorkerTile + WorkerTileSection in isolation.
          Project:{" "}
          <span className="text-foreground font-medium">
            {project?.name ?? "loading…"}
          </span>
          . Click tiles to toggle, change shift, expand options. The first
          worker is locked to demo the "already logged" state.{" "}
          <span className="font-medium">{checkedCount}</span> currently
          selected.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <WorkerTileSection
            heading="Recent (last 7 days)"
            countLabel={`${recent.length} workers`}
          >
            {recent.map((w) => {
              const s = getState(w.id);
              return (
                <WorkerTile
                  key={w.id}
                  worker={w}
                  checked={s.checked}
                  shiftType={s.shiftType}
                  expanded={s.expanded}
                  locked={w.id === lockedWorkerId}
                  onToggle={(next) => update(w.id, { checked: next })}
                  onShiftChange={(next) => update(w.id, { shiftType: next })}
                  onToggleExpanded={() =>
                    update(w.id, { expanded: !s.expanded })
                  }
                />
              );
            })}
          </WorkerTileSection>

          {rest.length > 0 && (
            <WorkerTileSection
              heading="All workers"
              countLabel={`${rest.length} workers`}
            >
              {rest.map((w) => {
                const s = getState(w.id);
                return (
                  <WorkerTile
                    key={w.id}
                    worker={w}
                    checked={s.checked}
                    shiftType={s.shiftType}
                    expanded={s.expanded}
                    onToggle={(next) => update(w.id, { checked: next })}
                    onShiftChange={(next) => update(w.id, { shiftType: next })}
                    onToggleExpanded={() =>
                      update(w.id, { expanded: !s.expanded })
                    }
                  />
                );
              })}
            </WorkerTileSection>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
