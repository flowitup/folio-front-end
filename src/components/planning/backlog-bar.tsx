"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task, TaskPriority } from "@/types/task";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-slate-300",
  medium: "bg-blue-400",
  high: "bg-orange-400",
  urgent: "bg-red-500",
};

interface BacklogBarProps {
  tasks: Task[];
  onAdd: () => void;
  onTaskClick: (task: Task) => void;
}

/**
 * Collapsible backlog row above the Kanban columns. Cards are draggable INTO
 * board columns (status changes to "todo"/etc.) and within the backlog itself.
 */
export function BacklogBar({ tasks, onAdd, onTaskClick }: BacklogBarProps) {
  const t = useTranslations("planning");
  const [expanded, setExpanded] = useState(true);

  const { setNodeRef, isOver } = useDroppable({
    id: "column-backlog",
    data: { type: "column", status: "backlog" },
  });

  return (
    <div className="border rounded-lg bg-muted/30">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <h3 className="text-sm font-semibold">{t("backlog")}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </button>

      {/* Body */}
      {expanded && (
        <div
          ref={setNodeRef}
          className={`p-3 transition-colors ${isOver ? "bg-primary/5" : ""}`}
        >
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">{t("backlogEmpty")}</p>
          ) : (
            <SortableContext items={tasks.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tasks.map((task) => (
                  <BacklogCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

interface BacklogCardProps {
  task: Task;
  onClick: () => void;
}

/** Compact horizontally-arranged card for the backlog row. */
function BacklogCard({ task, onClick }: BacklogCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        flex-shrink-0 w-56 rounded-md border bg-card p-2 shadow-sm cursor-grab active:cursor-grabbing
        hover:shadow-md transition-shadow
        ${isDragging ? "opacity-40" : ""}
      `}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`}
          title={task.priority}
        />
        <p className="text-xs font-medium truncate">{task.title}</p>
      </div>
    </div>
  );
}
