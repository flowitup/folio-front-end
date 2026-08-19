"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { TaskCard } from "@/components/planning/task-card";
import type { Task, TaskStatus } from "@/types/task";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  onAdd?: () => void;
  onTaskClick: (task: Task) => void;
  /**
   * Suppress the column's own title row. Set by the mobile pager, which
   * already names the visible column in its own header — rendering both
   * prints the column name twice.
   */
  hideHeader?: boolean;
}

export function KanbanColumn({ status, title, tasks, onAdd, onTaskClick, hideHeader = false }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  return (
    <div className="lane flex flex-shrink-0 flex-col">
      <div className={`mb-2 flex items-center px-1 ${hideHeader ? "justify-end" : "justify-between"}`}>
        <div className={`flex items-center gap-2 ${hideHeader ? "hidden" : ""}`}>
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            {title}
          </h3>
          <span
            className="num text-[11px] tabular-nums"
            style={{ color: "var(--muted)" }}
          >
            {tasks.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="btn btn-quiet"
            aria-label="Add task"
            style={{ padding: 4 }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className="min-h-[200px] flex-1 space-y-2 rounded-[10px] p-1 transition-colors"
        style={{ background: isOver ? "rgba(232,132,60,0.08)" : "transparent" }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
