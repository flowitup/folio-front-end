"use client";

/**
 * CalendarCell — single day in the labor month calendar (Phase 2b).
 *
 * Renders day number, day total €, and a stack of colored Person chips
 * (max 3 visible on desktop, then "+N"; mobile collapses to 4 dots only).
 *
 * Empty days dimmed; weekends get a faint background; today gets an
 * accent border. Click delegates to the parent (Phase 2c wires it to
 * the day-detail drawer).
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2b).
 */

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { isToday, isWeekend } from "@/lib/utils/calendar-month";
import { personColor, personInitials } from "@/lib/utils/person-color";
import { formatEUR } from "@/lib/api/labor";
import type { LaborEntry } from "@/types/labor";

interface CalendarCellProps {
  /** The Date this cell represents, or null for grid padding cells. */
  date: Date | null;
  /** Entries for this day (already filtered by parent). */
  entries: LaborEntry[];
  /** Click handler. Receives the cell's date (null for padding). */
  onClick?: (date: Date | null) => void;
  /** Max chips shown before collapsing to "+N". Defaults to 3. */
  maxChips?: number;
}

interface ChipDescriptor {
  id: string;
  name: string;
}

export function CalendarCell({
  date,
  entries,
  onClick,
  maxChips = 3,
}: CalendarCellProps) {
  // Aggregate the day's data once per render.
  const { dayTotal, chips, overflow } = useMemo(() => {
    const total = entries.reduce(
      (sum, e) => sum + Number(e.effective_cost ?? 0),
      0,
    );
    // De-duplicate by person_id (or worker_id fallback) — same worker
    // could appear twice on a day if a supplement-only entry coexists
    // with a shift entry, but we only want one chip per person.
    const seen = new Set<string>();
    const list: ChipDescriptor[] = [];
    for (const e of entries) {
      const id = e.worker_id; // Worker id is fine for chip color; people stable per worker.
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, name: e.worker_name });
    }
    const shown = list.slice(0, maxChips);
    const rest = Math.max(0, list.length - maxChips);
    return { dayTotal: total, chips: shown, overflow: rest };
  }, [entries, maxChips]);

  // Padding cell (before first-of-month or after last-of-month).
  if (date === null) {
    return (
      <div
        aria-hidden="true"
        className="border-border/30 bg-muted/20 min-h-20 rounded-md border"
      />
    );
  }

  const today = isToday(date);
  const weekend = isWeekend(date);
  const empty = entries.length === 0;

  return (
    <button
      type="button"
      onClick={() => onClick?.(date)}
      className={cn(
        "min-h-20 rounded-md border p-2 text-left transition",
        "flex flex-col gap-1.5",
        "hover:border-primary/60 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring",
        weekend ? "bg-muted/40" : "bg-background",
        today ? "border-primary ring-1 ring-primary/40" : "border-border",
        empty && "opacity-60",
      )}
      aria-label={date.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            "text-sm font-medium",
            today && "text-primary",
            empty && "text-muted-foreground",
          )}
        >
          {date.getDate()}
        </span>
        {dayTotal > 0 && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatEUR(dayTotal)}
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {chips.map((c) => (
            <span
              key={c.id}
              title={c.name}
              className="text-[10px] inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-white"
              style={{ backgroundColor: personColor(c.id) }}
            >
              {personInitials(c.name)}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-muted-foreground text-[10px] font-medium">
              +{overflow}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
