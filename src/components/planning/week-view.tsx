"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addWeeks,
  formatWeekRange,
  startOfWeekMonday,
  toDateKey,
  weekDays,
} from "@/lib/planning/week";
import type { Task, TaskPriority, TaskStatus } from "@/types/task";

// Same priority→dot mapping as the Kanban card so the two views read alike.
const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  low: "",
  medium: "accent",
  high: "warning",
  urgent: "negative",
};

// Visual weight for in-day ordering: urgent first, then high/medium/low, then title.
const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

interface WeekViewProps {
  tasks: Task[];
  weekOffset: number;
  onWeekOffsetChange: (n: number) => void;
  onTaskClick: (task: Task) => void;
  /** Empty string → unscheduled (null due date); a dateKey → that day. */
  onAddForDate: (dateKey: string) => void;
}

/**
 * Monday→Sunday weekly lens over a project's tasks, grouped by `due_date`.
 * Presentational: no fetching, no DnD. Click opens the shared detail drawer;
 * per-day "+" opens the shared create dialog with the due date pre-filled.
 */
export function WeekView({
  tasks,
  weekOffset,
  onWeekOffsetChange,
  onTaskClick,
  onAddForDate,
}: WeekViewProps) {
  const t = useTranslations("planning");
  const locale = useLocale();

  const weekStart = useMemo(
    () => addWeeks(startOfWeekMonday(new Date()), weekOffset),
    [weekOffset],
  );
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const todayKey = toDateKey(new Date());

  // Bucket tasks: by due-date key for in-week days, plus an unscheduled list.
  const { byDay, unscheduled } = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const none: Task[] = [];
    const sortFn = (a: Task, b: Task) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title);
    for (const task of tasks) {
      if (!task.due_date) {
        none.push(task);
        continue;
      }
      (map[task.due_date] ??= []).push(task);
    }
    for (const list of Object.values(map)) list.sort(sortFn);
    none.sort(sortFn);
    return { byDay: map, unscheduled: none };
  }, [tasks]);

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-quiet"
            style={{ padding: 4 }}
            aria-label={t("weekView.prevWeek")}
            onClick={() => onWeekOffsetChange(weekOffset - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="btn btn-quiet text-[12px]"
            onClick={() => onWeekOffsetChange(0)}
          >
            {t("weekView.thisWeek")}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ padding: 4 }}
            aria-label={t("weekView.nextWeek")}
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="num text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
          {formatWeekRange(weekStart, locale)}
        </span>
      </div>

      {/* 7-day grid (Mon→Sun) */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayTasks = byDay[key] ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className="flex min-h-[160px] flex-col rounded-[10px] p-2"
              style={{
                border: isToday ? "1px solid var(--accent)" : "1px solid var(--line)",
                background: isToday ? "rgba(232,132,60,0.05)" : "var(--paper)",
              }}
            >
              <div className="mb-2 flex items-center justify-between px-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: isToday ? "var(--accent)" : "var(--muted)" }}
                  >
                    {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day)}
                  </span>
                  <span
                    className="num text-[13px] font-semibold tabular-nums"
                    style={{ color: isToday ? "var(--accent)" : "var(--ink)" }}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-quiet"
                  style={{ padding: 3 }}
                  aria-label={t("weekView.addOnDay")}
                  onClick={() => onAddForDate(key)}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                {dayTasks.length === 0 ? (
                  <span className="px-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    {t("weekView.noTasksDay")}
                  </span>
                ) : (
                  dayTasks.map((task) => (
                    <WeekTaskChip key={task.id} task={task} statusLabel={t(statusKey(task.status))} onClick={() => onTaskClick(task)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled bucket */}
      <div className="rounded-[10px] p-2" style={{ border: "1px dashed var(--line)" }}>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              {t("weekView.unscheduled")}
            </h3>
            <span className="num text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
              {unscheduled.length}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ padding: 3 }}
            aria-label={t("weekView.addOnDay")}
            onClick={() => onAddForDate("")}
          >
            <Plus size={13} />
          </button>
        </div>
        {unscheduled.length === 0 ? (
          <span className="px-1 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("weekView.noTasksDay")}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((task) => (
              <div key={task.id} className="min-w-[180px] flex-1">
                <WeekTaskChip task={task} statusLabel={t(statusKey(task.status))} onClick={() => onTaskClick(task)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusKey(status: TaskStatus): string {
  // Backlog isn't a board column; it has its own top-level key.
  return status === "backlog" ? "backlog" : `column.${status}`;
}

interface WeekTaskChipProps {
  task: Task;
  statusLabel: string;
  onClick: () => void;
}

/**
 * Compact, non-draggable task chip for the week grid. Deliberately NOT the
 * Kanban `TaskCard` — that relies on `useSortable`, which requires a DndContext
 * ancestor the week view doesn't provide.
 */
function WeekTaskChip({ task, statusLabel, onClick }: WeekTaskChipProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onClick();
        }
      }}
      className="task-card focus:outline-none"
      style={{ padding: "6px 8px" }}
    >
      <div className="flex items-start gap-1.5">
        <span
          className={`dot ${PRIORITY_DOT_CLASS[task.priority]} mt-1 flex-shrink-0`}
          title={task.priority}
        />
        <p className="text-[12.5px] font-medium leading-snug">{task.title}</p>
      </div>
      <span className="mt-1 inline-block text-[10px]" style={{ color: "var(--muted)" }}>
        {statusLabel}
      </span>
    </div>
  );
}
