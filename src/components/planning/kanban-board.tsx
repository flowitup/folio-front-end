"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Loader2, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BacklogBar } from "@/components/planning/backlog-bar";
import { KanbanColumn } from "@/components/planning/kanban-column";
import { TaskCard } from "@/components/planning/task-card";
import { TaskDetailDrawer } from "@/components/planning/task-detail-drawer";
import { TaskCreateDialog } from "@/components/planning/task-create-dialog";
import { fetchTasks, moveTask } from "@/lib/api/task-api";
import { BOARD_COLUMNS } from "@/types/task";
import type { Task, TaskStatus } from "@/types/task";

interface KanbanBoardProps {
  projectId: string;
}

/**
 * Top-level Kanban orchestrator: manages task list, DnD, drawer + create dialog.
 *
 * State sync rules:
 * - URL `?task=<id>` is the source of truth for the open drawer (deep-linkable).
 * - Drag-drop applies optimistic UI + fires API; on error, refetches full board.
 */
export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const t = useTranslations("planning");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [createForStatus, setCreateForStatus] = useState<TaskStatus | null>(null);

  const sensors = useSensors(
    // Slight activation distance prevents click-without-drag from being treated
    // as a drag — this lets `onClick` on the card still fire to open the drawer.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchTasks(projectId);
      setTasks(data);
    } catch {
      setError(t("loadError"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => { reload(); }, [reload]);

  // Silent variant for mutation-triggered refreshes — avoids whole-board
  // spinner flash after a card create / edit / delete.
  const silentReload = useCallback(() => reload(true), [reload]);

  // Group tasks by status (ordered by position).
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      backlog: [], todo: [], in_progress: [], blocked: [], done: [],
    };
    for (const task of tasks) groups[task.status].push(task);
    for (const list of Object.values(groups)) list.sort((a, b) => a.position - b.position);
    return groups;
  }, [tasks]);

  const setSelected = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("task", id);
    else params.delete("task");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onDragStart = (event: DragStartEvent) => {
    const t = event.active.data.current?.task as Task | undefined;
    if (t) setActiveTask(t);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = active.data.current?.task as Task | undefined;
    if (!draggedTask) return;

    // Determine drop target + compute the neighbours that bracket the new
    // position. We send BOTH `before_id` (card immediately above the drop) and
    // `after_id` (card immediately below) so the backend can sandwich the new
    // position between them deterministically — not just nudge by POSITION_STEP.
    let targetStatus: TaskStatus | null = null;
    let beforeId: string | undefined;
    let afterId: string | undefined;

    const overData = over.data.current;
    if (overData?.type === "column") {
      // Dropped onto empty column space — append to end (no neighbours).
      targetStatus = overData.status as TaskStatus;
    } else if (overData?.type === "task") {
      const overTask = overData.task as Task;
      targetStatus = overTask.status;
      // Look up neighbours in the (sorted) column the user is dropping into.
      const lane = tasksByStatus[targetStatus]
        .filter((t) => t.id !== draggedTask.id)
        .sort((a, b) => a.position - b.position);
      const overIndex = lane.findIndex((t) => t.id === overTask.id);
      // Drop ABOVE the over-task: above-neighbour = lane[overIndex - 1], below-neighbour = overTask.
      const above = overIndex > 0 ? lane[overIndex - 1] : undefined;
      beforeId = above?.id;
      afterId = overTask.id;
    } else {
      return;
    }

    // No-op when dropping on the same task.
    if (targetStatus === draggedTask.status && active.id === over.id) return;

    // Optimistic update: move the task in local state immediately so the user
    // sees the drop land. We DO NOT snapshot+rollback on error: concurrent
    // drags would interleave snapshots and lose changes. Instead, on any
    // failure we reload authoritative state from the server.
    setTasks((curr) =>
      curr.map((tk) => (tk.id === draggedTask.id ? { ...tk, status: targetStatus! } : tk))
    );

    try {
      const updated = await moveTask(draggedTask.id, {
        status: targetStatus,
        before_id: beforeId,
        after_id: afterId,
      });
      // Sync with server-truth (position is now correct).
      setTasks((curr) => curr.map((tk) => (tk.id === updated.id ? updated : tk)));
    } catch {
      reload();
    }
  };

  if (loading) {
    return (
      <div className="folio-card flex items-center justify-center p-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  const totalCount = tasks.length;

  return (
    <div className="space-y-4">
      {/* Header: view selector + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="seg">
            <button type="button" className="on">{t("board")}</button>
            <button type="button">{t("list")}</button>
            <button type="button">{t("calendar")}</button>
          </div>
          <span className="num text-[11.5px]" style={{ color: "var(--muted)" }}>
            {t("taskCount", { n: totalCount })}
          </span>
        </div>
        <button type="button" className="btn btn-ghost">
          <Filter size={14} /> {t("filter")}
        </button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Backlog row across the top */}
        <BacklogBar
          tasks={tasksByStatus.backlog}
          onAdd={() => setCreateForStatus("backlog")}
          onTaskClick={(t) => setSelected(t.id)}
        />

        {/* 4 columns */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {BOARD_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              title={t(`column.${status}`)}
              tasks={tasksByStatus[status]}
              onAdd={() => setCreateForStatus(status)}
              onTaskClick={(t) => setSelected(t.id)}
            />
          ))}
        </div>

        {/* Drag overlay — semi-transparent floating card while dragging */}
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      {/* Detail drawer (right slide-in) */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        seed={tasks.find((t) => t.id === selectedTaskId) ?? null}
        onClose={() => setSelected(null)}
        onMutated={silentReload}
      />

      {/* Create dialog */}
      <TaskCreateDialog
        open={createForStatus !== null}
        projectId={projectId}
        defaultStatus={createForStatus ?? "backlog"}
        onOpenChange={(open) => { if (!open) setCreateForStatus(null); }}
        onCreated={silentReload}
      />
    </div>
  );
}
