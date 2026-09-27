"use client";

/**
 * useLastLoggedDay — derive the "Same as last logged day" selection
 * template from an already-loaded array of labor entries (Phase 3c).
 *
 * Returns the most-recent date that has any entry, plus the list of
 * workers logged on that date with their shift_type + supplement_hours.
 * The dialog applies this template to its tile state when the user
 * clicks the "Same as last day" button — no extra API call needed.
 *
 * Pure derivation; memoized over the entries reference so the dialog
 * can call it on every render without churn.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-03 (3c).
 */

import { useMemo } from "react";

import type { LaborEntry, ShiftType } from "@/types/labor";

export interface LastDayWorkerSelection {
  worker_id: string;
  shift_type: ShiftType | null;
  supplement_hours: number;
}

export interface LastDayTemplate {
  /** YYYY-MM-DD of the most recent day with any entry, or null. */
  date: string | null;
  /** Workers logged on that date. Empty if no entries exist. */
  workers: LastDayWorkerSelection[];
}

/**
 * @param beforeDate  when given (the day being logged), only days strictly
 *   before it count — "last day" is the one before the picked date, not the
 *   latest date anywhere (a future day logged ahead).
 */
export function useLastLoggedDay(entries: LaborEntry[], beforeDate?: string): LastDayTemplate {
  return useMemo(() => {
    // Only days a manager stands by: a worker's pending proposal is not a
    // template (absent status on older responses means validated).
    const usable = entries.filter(
      (e) =>
        (e.status === undefined || e.status === "validated") &&
        (beforeDate === undefined || e.date < beforeDate)
    );
    if (usable.length === 0) {
      return { date: null, workers: [] };
    }

    let lastDate: string | null = null;
    for (const e of usable) {
      if (lastDate === null || e.date > lastDate) {
        lastDate = e.date;
      }
    }
    if (lastDate === null) return { date: null, workers: [] };

    const onLastDay = usable.filter((e) => e.date === lastDate);
    // Dedupe by worker_id; the BE rejects duplicates per (project, worker,
    // date) so this is defensive — but if the source ever changes (e.g.
    // multiple shifts/day), the first occurrence wins.
    const seen = new Set<string>();
    const workers: LastDayWorkerSelection[] = [];
    for (const e of onLastDay) {
      if (seen.has(e.worker_id)) continue;
      seen.add(e.worker_id);
      workers.push({
        worker_id: e.worker_id,
        shift_type: e.shift_type ?? "full",
        supplement_hours: e.supplement_hours ?? 0,
      });
    }

    return { date: lastDate, workers };
  }, [entries, beforeDate]);
}
