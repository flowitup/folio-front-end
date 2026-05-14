"use client";

/**
 * CalendarMonthGrid — 7-column Monday-first grid of CalendarCells for
 * a given month (Phase 2b).
 *
 * Groups the flat LaborEntry array into a date-keyed map and feeds each
 * day's slice into <CalendarCell>. Weekday headers above the grid match
 * the locale (Mon, Tue, ... in en-US; lun., mar., ... in fr-FR).
 *
 * Pure presentational; no fetching, no state. The orchestrator
 * (AttendanceCalendar, Phase 2c) drives month navigation and entry
 * loading and passes the slice down.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2b).
 */

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { buildMonthGrid, toDateKey } from "@/lib/utils/calendar-month";
import { CalendarCell } from "@/components/labor/calendar-cell";
import type { LaborEntry } from "@/types/labor";

interface CalendarMonthGridProps {
  year: number;
  /** 0-based month index (0 = January). */
  monthIdx: number;
  entries: LaborEntry[];
  onDayClick?: (date: Date) => void;
  /** BCP-47 locale tag. Defaults to the browser's. */
  locale?: string;
  className?: string;
}

export function CalendarMonthGrid({
  year,
  monthIdx,
  entries,
  onDayClick,
  locale,
  className,
}: CalendarMonthGridProps) {
  const effectiveLocale = locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");

  // Monday-first cell array, padded with nulls to a multiple of 7.
  const cells = useMemo(
    () => buildMonthGrid(year, monthIdx),
    [year, monthIdx],
  );

  // O(1) lookup of entries per day. The repeated reduce on every cell
  // render would be wasteful — group once.
  const entriesByDay = useMemo(() => {
    const map = new Map<string, LaborEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date);
      if (arr) {
        arr.push(e);
      } else {
        map.set(e.date, [e]);
      }
    }
    return map;
  }, [entries]);

  // Weekday header labels, Monday-first. We derive these from the
  // locale by formatting a known set of dates (2026-04-06 is a Monday,
  // 2026-04-12 is the following Sunday) so the labels stay translated.
  const weekdayLabels = useMemo(() => {
    const monday = new Date(2026, 3, 6); // Mon 6 Apr 2026
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d
        .toLocaleDateString(effectiveLocale, { weekday: "short" })
        .replace(/\.$/, "");
    });
  }, [effectiveLocale]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Weekday header row */}
      <div
        className="text-foreground/70 grid grid-cols-7 gap-1.5 text-xs"
        aria-hidden="true"
      >
        {weekdayLabels.map((label) => (
          <div key={label} className="px-2 py-1 font-medium uppercase tracking-wide">
            {label}
          </div>
        ))}
      </div>

      {/* Cell grid */}
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          const dayEntries = date ? entriesByDay.get(toDateKey(date)) ?? [] : [];
          return (
            <CalendarCell
              key={date ? toDateKey(date) : `pad-${i}`}
              date={date}
              entries={dayEntries}
              onClick={(d) => d && onDayClick?.(d)}
            />
          );
        })}
      </div>
    </div>
  );
}
