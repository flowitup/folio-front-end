"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { KanbanColumn } from "@/components/planning/kanban-column";
import { BOARD_COLUMNS } from "@/types/task";
import type { Task, TaskStatus } from "@/types/task";

interface KanbanMobilePagerProps {
  tasksByStatus: Record<TaskStatus, Task[]>;
  onAdd: (status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
}

/**
 * One board column at a time, for phone viewports.
 *
 * The desktop board lays all four columns side by side inside a horizontal
 * scroller. At ~390px that gives each column roughly 90px of usable width, so
 * the mobile board pages through columns instead.
 *
 * Paging is driven by buttons and dot controls rather than swipe: the columns
 * sit inside a vertically-scrolling page, and a horizontal swipe handler there
 * competes with the browser's own scroll and back-gesture. Buttons also give
 * the control a keyboard and screen-reader surface for free.
 *
 * Tasks render without drag sensors here — moving a task on mobile goes
 * through the detail drawer's status control, which calls the same `moveTask`
 * endpoint the desktop drag does.
 */
export function KanbanMobilePager({
  tasksByStatus,
  onAdd,
  onTaskClick,
}: KanbanMobilePagerProps) {
  const t = useTranslations("planning");
  const [index, setIndex] = useState(0);

  const status = BOARD_COLUMNS[index];
  const count = tasksByStatus[status]?.length ?? 0;
  const atStart = index === 0;
  const atEnd = index === BOARD_COLUMNS.length - 1;

  return (
    <div data-testid="kanban-mobile-pager">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={atStart}
          aria-label={t("pager.previousColumn")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] disabled:opacity-35"
          style={{
            background: "var(--card-paper)",
            border: "1px solid var(--line-2)",
            color: "var(--ink-2)",
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold">
            {t(`column.${status}`)}
          </span>
          <span
            className="num rounded-full px-2 py-0.5 text-[11px]"
            style={{
              background: "var(--paper-2)",
              border: "1px solid var(--line-2)",
              color: "var(--muted)",
            }}
          >
            {count}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(BOARD_COLUMNS.length - 1, i + 1))}
          disabled={atEnd}
          aria-label={t("pager.nextColumn")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] disabled:opacity-35"
          style={{
            background: "var(--card-paper)",
            border: "1px solid var(--line-2)",
            color: "var(--ink-2)",
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <KanbanColumn
        status={status}
        title={t(`column.${status}`)}
        tasks={tasksByStatus[status]}
        onAdd={() => onAdd(status)}
        onTaskClick={onTaskClick}
        hideHeader
      />

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {BOARD_COLUMNS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={t(`column.${s}`)}
            aria-current={i === index}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 18 : 6,
              background: i === index ? "var(--accent)" : "var(--line-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
