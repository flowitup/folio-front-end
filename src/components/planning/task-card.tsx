"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, AlertCircle } from "lucide-react";
import type { Task, TaskPriority } from "@/types/task";

const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
  low: "",
  medium: "accent",
  high: "warning",
  urgent: "negative",
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
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
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="task-card focus:outline-none"
    >
      <div className="mb-2 flex items-start gap-2">
        <span
          className={`dot ${PRIORITY_DOT_CLASS[task.priority]} mt-1.5 flex-shrink-0`}
          title={task.priority}
        />
        <p className="text-[13.5px] font-medium leading-snug">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
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
        className="flex items-center justify-between text-[11px]"
        style={{ color: "var(--muted)" }}
      >
        {task.due_date ? (
          <span className="num flex items-center gap-1">
            <Calendar size={12} />
            {task.due_date}
          </span>
        ) : (
          <span />
        )}
        {task.priority === "urgent" && (
          <AlertCircle size={13} style={{ color: "var(--negative)" }} />
        )}
      </div>
    </div>
  );
}
