"use client";

/**
 * /calendar-preview — Phase 2b harness for the labor calendar.
 *
 * Standalone page hosting <CalendarMonthGrid> against a chosen
 * project's labor entries. Prev/next month nav lets us scrub.
 *
 * Project id is picked from the user's first accessible project at
 * mount. The whole page is throwaway — once Phase 2d wires the
 * calendar into LaborPage behind a view toggle, this route should
 * be deleted along with /persons-demo.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2b).
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarMonthGrid } from "@/components/labor/calendar-month-grid";
import { AttendanceDayDetailSheet } from "@/components/labor/attendance-day-detail-sheet";
import { api } from "@/lib/api/http";
import { fetchLaborEntries } from "@/lib/api/labor";
import { monthLabel, toDateKey } from "@/lib/utils/calendar-month";
import type { LaborEntry } from "@/types/labor";

interface ProjectSummary {
  id: string;
  name: string;
}

export default function CalendarPreviewPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIdx, setMonthIdx] = useState(today.getMonth());

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [entries, setEntries] = useState<LaborEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Day-detail sheet state. Track the clicked Date directly; the
  // entries for it are derived from `entries` at render time.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Pick the first accessible project that actually has workers, since
  // the demo needs entries to be visible. Falls back to the first
  // project of any kind if none have workers yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ projects: ProjectSummary[] }>("/projects");
        if (cancelled) return;
        const projects = data.projects ?? [];
        if (projects.length === 0) {
          setError("No projects available");
          return;
        }
        // Probe each project's workers — pick the first non-empty.
        for (const p of projects) {
          try {
            const ws = await api.get<{ total: number }>(
              `/projects/${p.id}/workers`,
            );
            if (cancelled) return;
            if ((ws.total ?? 0) > 0) {
              setProject(p);
              return;
            }
          } catch {
            // ignore and continue
          }
        }
        if (!cancelled) setProject(projects[0]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load projects");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch entries for the current month whenever the cursor moves.
  const loadEntries = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const lastDay = new Date(year, monthIdx + 1, 0).getDate();
      const mm = String(monthIdx + 1).padStart(2, "0");
      const from = `${year}-${mm}-01`;
      const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
      const data = await fetchLaborEntries(project.id, { from, to });
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [project, year, monthIdx]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  function step(delta: number) {
    const next = new Date(year, monthIdx + delta, 1);
    setYear(next.getFullYear());
    setMonthIdx(next.getMonth());
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Labor calendar preview
        </h1>
        <p className="text-muted-foreground text-sm">
          Phase 2b harness — fetches entries for{" "}
          <span className="font-medium text-foreground">
            {project?.name ?? "…"}
          </span>{" "}
          and renders the month-grid. Prev/next move the cursor; click a
          cell to log the date (drawer arrives in 2c).
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold capitalize">
              {monthLabel(new Date(year, monthIdx, 1), "en-US")}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => step(-1)}
                aria-label="Previous month"
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => step(1)}
                aria-label="Next month"
                disabled={loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : (
            <CalendarMonthGrid
              year={year}
              monthIdx={monthIdx}
              entries={entries}
              onDayClick={(d) => setSelectedDate(d)}
            />
          )}

          <p className="text-muted-foreground text-xs">
            {entries.length} entries this month
          </p>
        </CardContent>
      </Card>

      <AttendanceDayDetailSheet
        date={selectedDate}
        entries={
          selectedDate
            ? entries.filter((e) => e.date === toDateKey(selectedDate))
            : []
        }
        open={selectedDate !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedDate(null);
        }}
        canManage={false}
        onDelete={() => {
          // Delete wiring lands in Phase 2d when the calendar moves
          // into LaborPage and gains the existing delete flow.
        }}
      />
    </div>
  );
}
