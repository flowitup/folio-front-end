"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, AlertCircle, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/utils/formatters";
import type { Task, TaskPriority } from "@/types/task";

const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  low: "",
  medium: "accent",
  high: "warning",
  urgent: "negative",
};

interface TaskCardProps {
  task: Task;
  /** Name of the person the task is assigned to; nothing shown when unknown. */
  assigneeName?: string | null;
  onClick: () => void;
}

export function TaskCard({ task, assigneeName, onClick }: TaskCardProps) {
  const t = useTranslations("planning");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      // Enter opens the task; every other key goes on to dnd-kit's listener,
      // so Space picks the card up to move it with the arrow keys. (Replacing
      // its onKeyDown outright left keyboard users no way to move a card.)
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isDragging) {
          e.preventDefault();
          onClick();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      role="button"
      tabIndex={0}
      className="task-card focus:outline-none"
    >
      <div className="mb-2 flex items-start gap-2">
        <span
          className={`dot ${PRIORITY_DOT_CLASS[task.priority]} mt-1.5 flex-shrink-0`}
          title={t(`priority.${task.priority}`)}
          role="img"
          aria-label={t(`priority.${task.priority}`)}
        />
        <p className="min-w-0 text-[13.5px] font-medium leading-snug [overflow-wrap:anywhere]">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              title={label}
              className="max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: "var(--paper-2)",
                color: "var(--ink-2)",
                border: "1px solid var(--line)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between gap-2 text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        {task.due_date ? (
          <span className="num flex flex-shrink-0 items-center gap-1">
            <Calendar size={12} />
            {formatDate(task.due_date)}
          </span>
        ) : (
          <span />
        )}
        <span className="flex min-w-0 items-center gap-1.5">
          {assigneeName && (
            <span className="flex min-w-0 items-center gap-1" title={t("assignedTo", { name: assigneeName })}>
              <User size={12} className="flex-shrink-0" aria-hidden />
              <span className="truncate" aria-hidden>{assigneeName}</span>
              <span className="sr-only">{t("assignedTo", { name: assigneeName })}</span>
            </span>
          )}
          {task.priority === "urgent" && (
            <AlertCircle size={13} className="flex-shrink-0" style={{ color: "var(--negative)" }} />
          )}
        </span>
      </div>
    </div>
  );
}
