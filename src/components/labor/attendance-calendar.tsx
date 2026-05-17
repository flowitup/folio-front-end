"use client";

/**
 * AttendanceCalendar — calendar variant of the attendance tab (Phase
 * 2d). Same prop contract as AttendanceTable so LaborPage can swap
 * between the two via a view toggle without restructuring its state.
 *
 * Owns the day-detail sheet locally; month state is delegated to the
 * parent (entriesMonth / onMonthChange) so the choice survives tab
 * + view-toggle switches.
 *
 * Plan: 260512-2341-labor-calendar-and-bulk-log → phase-02 (2d).
 */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarMonthGrid } from "@/components/labor/calendar-month-grid";
import { AttendanceDayDetailSheet } from "@/components/labor/attendance-day-detail-sheet";
import {
  formatMonthTag,
  monthLabel,
  parseMonthTag,
  toDateKey,
} from "@/lib/utils/calendar-month";
import type { LaborEntry, Worker } from "@/types/labor";

interface AttendanceCalendarProps {
  entries: LaborEntry[];
  workers: Worker[];
  isLoading: boolean;
  canManage: boolean;
  /** YYYY-MM — empty defaults to current month for the calendar. */
  month: string;
  workerFilter: string;
  onMonthChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  onDelete: (entry: LaborEntry) => void;
  /** Open the bulk-log dialog for a given YYYY-MM-DD. */
  onLogDay?: (date: string) => void;
  /** Open the edit dialog for a single existing entry. */
  onEditEntry?: (entry: LaborEntry) => void;
  /** Worker lookup for role-aware chip colors. See CalendarCell. */
  workerMap?: Record<string, Worker>;
}

export function AttendanceCalendar({
  entries,
  workers,
  isLoading,
  canManage,
  month,
  workerFilter,
  onMonthChange,
  onWorkerFilterChange,
  onDelete,
  onLogDay,
  onEditEntry,
  workerMap,
}: AttendanceCalendarProps) {
  const t = useTranslations("labor");
  const locale = useLocale();

  // Calendar needs an explicit (year, monthIdx). Parse the parent's
  // YYYY-MM tag, fall back to "today" when empty. We don't push the
  // fallback back to onMonthChange — the parent's "" semantic
  // (all-history list) is preserved for the list view when toggled.
  const cursor = useMemo(() => {
    const parsed = month ? parseMonthTag(month) : null;
    if (parsed) return parsed;
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, [month]);

  function stepMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    onMonthChange(formatMonthTag(next));
  }

  // Apply worker filter at the entry level. "all" or empty = no filter.
  const filteredEntries = useMemo(() => {
    if (!workerFilter || workerFilter === "all") return entries;
    return entries.filter((e) => e.worker_id === workerFilter);
  }, [entries, workerFilter]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const dayEntries = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    return filteredEntries.filter((e) => e.date === key);
  }, [filteredEntries, selectedDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Header row — month nav (left) + worker filter (right). The
          all-history mode of the list view doesn't apply here because
          a calendar is inherently month-scoped; clicking the toggle
          back to "list" restores the parent's empty-month default. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[10ch] text-base font-semibold capitalize">
            {monthLabel(cursor, locale)}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => stepMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs">{t("filterWorker")}</Label>
          <Select value={workerFilter} onValueChange={onWorkerFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("filterWorker")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filterWorker")}</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.person_name ?? w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CalendarMonthGrid
        className="min-h-0 flex-1"
        year={cursor.getFullYear()}
        monthIdx={cursor.getMonth()}
        entries={filteredEntries}
        locale={locale}
        workerMap={workerMap}
        onDayClick={(d) => {
          // Empty-cell click: jump straight to the log dialog. Days
          // with entries open the detail sheet first.
          const hasEntries = filteredEntries.some((e) => e.date === toDateKey(d));
          if (!hasEntries && onLogDay && canManage) {
            onLogDay(toDateKey(d));
          } else {
            setSelectedDate(d);
          }
        }}
      />

      <AttendanceDayDetailSheet
        date={selectedDate}
        entries={dayEntries}
        open={selectedDate !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedDate(null);
        }}
        canManage={canManage}
        onDelete={onDelete}
        onEdit={onEditEntry}
        onAddMore={
          selectedDate && onLogDay
            ? () => {
                const key = toDateKey(selectedDate);
                setSelectedDate(null);
                onLogDay(key);
              }
            : undefined
        }
      />
    </div>
  );
}
