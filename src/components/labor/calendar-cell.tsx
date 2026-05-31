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
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { isToday } from "@/lib/utils/calendar-month";
import { getFrenchHolidayKey } from "@/lib/utils/french-holidays";
import { personColor, workerColor } from "@/lib/utils/person-color";
import { formatEUR } from "@/lib/api/labor";
import type { LaborEntry, LaborActivity, Worker, ShiftType } from "@/types/labor";

interface CalendarCellProps {
  /** The Date this cell represents, or null for grid padding cells. */
  date: Date | null;
  /** Entries for this day (already filtered by parent). */
  entries: LaborEntry[];
  /** Activities for this day. */
  activities?: LaborActivity[];
  /** Click handler. Receives the cell's date (null for padding). */
  onClick?: (date: Date | null) => void;
  /** Max chips shown before collapsing to "+N". Defaults to 3. */
  maxChips?: number;
  /**
   * Worker lookup map keyed by worker id. When provided, chip color is
   * resolved via workerColor (respects role_color). Falls back to
   * personColor(worker_id) when absent for backward compat.
   */
  workerMap?: Record<string, Worker>;
}

interface ChipDescriptor {
  id: string;
  name: string;
  chipColor: string;
  shiftType: ShiftType | null;
  supplementHours: number;
}

export function CalendarCell({
  date,
  entries,
  activities = [],
  onClick,
  maxChips = 3,
  workerMap,
}: CalendarCellProps) {
  const t = useTranslations("labor");
  const locale = useLocale();

  // Aggregate the day's data once per render.
  const { dayTotal, chips, overflow } = useMemo(() => {
    const total = entries.reduce(
      (sum, e) => sum + Number(e.effective_cost ?? 0),
      0,
    );
    // De-duplicate by worker_id — same worker could appear twice on a day
    // if a supplement-only entry coexists with a shift entry, but we only
    // want one chip per worker.
    const seen = new Set<string>();
    const list: ChipDescriptor[] = [];
    for (const e of entries) {
      const id = e.worker_id;
      if (seen.has(id)) continue;
      seen.add(id);
      // Resolve chip color: workerMap → workerColor (role_color aware);
      // fall back to personColor(worker_id) when map is unavailable.
      const worker = workerMap?.[id];
      const chipColor = worker ? workerColor(worker) : personColor(id);
      list.push({
        id,
        name: e.worker_name,
        chipColor,
        shiftType: e.shift_type,
        supplementHours: e.supplement_hours,
      });
    }
    const shown = list.slice(0, maxChips);
    const rest = Math.max(0, list.length - maxChips);
    return { dayTotal: total, chips: shown, overflow: rest };
  }, [entries, maxChips, workerMap]);

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
  const sunday = date.getDay() === 0;
  const empty = entries.length === 0 && activities.length === 0;
  const holidayKey = getFrenchHolidayKey(date);
  const holidayName = holidayKey ? t(`holidays.${holidayKey}`) : null;

  return (
    <button
      type="button"
      onClick={() => onClick?.(date)}
      className={cn(
        "min-h-20 rounded-md border p-2 text-left transition",
        "flex flex-col gap-1.5",
        "hover:border-primary/60 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring",
        holidayName ? "bg-rose-50" : sunday ? "bg-muted/40" : "bg-card",
        today ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
      title={holidayName ?? undefined}
      aria-label={
        date.toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }) + (holidayName ? ` — ${holidayName} (${t("holidays.publicHoliday")})` : "")
      }
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            "text-sm font-medium",
            today && "text-primary",
            empty && "text-foreground/70",
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

      {holidayName && (
        <span className="text-rose-700 truncate text-[10px] font-medium uppercase tracking-wide">
          {holidayName}
        </span>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {chips.map((c) => (
            <span
              key={c.id}
              title={c.name}
              className="text-[10px] inline-flex items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-white"
              style={{ backgroundColor: c.chipColor, maxWidth: "100%" }}
            >
              {c.name}
              {c.shiftType === "half" && (
                <span className="opacity-80" aria-label={t("shiftHalf")}>½</span>
              )}
              {c.supplementHours > 0 && (
                <span className="opacity-80">+{c.supplementHours}h</span>
              )}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-muted-foreground text-[10px] font-medium">
              +{overflow}
            </span>
          )}
        </div>
      )}

      {activities.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {activities.slice(0, 2).map((a) => (
            <span
              key={a.id}
              title={a.title}
              className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 truncate rounded px-1 py-0.5"
            >
              {a.title}
            </span>
          ))}
          {activities.length > 2 && (
            <span className="text-muted-foreground text-[10px] font-medium">
              +{activities.length - 2}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
