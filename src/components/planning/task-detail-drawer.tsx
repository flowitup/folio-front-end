"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/planning/task-form";
import { toast } from "sonner";
import { fetchTask, updateTask, deleteTask, moveTask } from "@/lib/api/task-api";
import { taskErrorKey } from "@/lib/planning/task-error";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOARD_COLUMNS } from "@/types/task";
import type { Task, TaskStatus, UpdateTaskPayload } from "@/types/task";

const STATUSES: TaskStatus[] = ["backlog", ...BOARD_COLUMNS];

interface TaskDetailDrawerProps {
  /** Currently selected task id from `?task=<id>`; null when closed. */
  taskId: string | null;
  /** Optional in-memory task seed (skips fetch if provided). */
  seed?: Task | null;
  onClose: () => void;
  onMutated?: () => void;
  /** Whether the caller may delete tasks here (the backend requires project
      write access); hides the trash button otherwise. */
  canDelete?: boolean;
}

const noopSubscribe = () => () => {};

/**
 * Right-side slide-in drawer (custom, no shadcn Sheet dep). Backdrop click +
 * Escape close. Fetches task on open unless a seed is provided.
 *
 * Portaled to document.body: rendered in place it sat inside the planning
 * page's `.fade-up` wrapper, whose animation leaves a transform that makes it
 * the containing block of fixed children, so on phones the drawer started
 * under the topbar, kept a gutter and was overlapped by the bottom nav.
 */
export function TaskDetailDrawer({
  taskId,
  seed,
  onClose,
  onMutated,
  canDelete = false,
}: TaskDetailDrawerProps) {
  const t = useTranslations("planning");
  const [task, setTask] = useState<Task | null>(seed ?? null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // The `?task=` id could not be loaded (deleted, another project's, no access).
  const [loadFailed, setLoadFailed] = useState(false);

  // Fetch when opening (unless seed already supplied for the same id).
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }
    if (seed && seed.id === taskId) {
      setTask(seed);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    fetchTask(taskId)
      .then((t) => { if (!cancelled) setTask(t); })
      .catch(() => {
        if (cancelled) return;
        setTask(null);
        setLoadFailed(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, seed]);

  // Only portal on the client (document does not exist during SSR).
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Esc to close — unless a nested layer (the priority Select, a popover)
  // already handled that Escape to close itself: Radix prevent-defaults it,
  // and closing the whole drawer then discarded the user's edits.
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, onClose]);

  const handleUpdate = async (payload: UpdateTaskPayload) => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await updateTask(task.id, payload);
      setTask(updated);
      onMutated?.();
      toast.success(t("saved"));
    } catch (err) {
      // The form keeps the user's edits; say why the save failed.
      toast.error(t(`errors.${taskErrorKey(err, "save")}`));
    } finally {
      setSaving(false);
    }
  };

  // Moving a card between lanes is otherwise drag-only, which touch screens
  // and keyboard-less users cannot always do. No neighbour ids: the backend
  // appends the task to the end of the new lane.
  const handleStatusChange = async (status: TaskStatus) => {
    if (!task || status === task.status) return;
    setSaving(true);
    try {
      const moved = await moveTask(task.id, { status });
      setTask(moved);
      onMutated?.();
    } catch (err) {
      toast.error(t(`errors.${taskErrorKey(err, "save")}`));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteTask(task.id);
    } catch (err) {
      toast.error(t(`errors.${taskErrorKey(err, "delete")}`));
      return;
    }
    onMutated?.();
    onClose();
  };

  if (!taskId || !isClient) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label={task?.title ?? t("taskDetail")}
        className="fixed right-0 top-0 h-screen w-full max-w-md bg-background border-l shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold truncate">
            {task?.title ?? t("taskDetail")}
          </h2>
          <div className="flex items-center gap-1">
            {task && canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                aria-label={t("delete")}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("close")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && !task && loadFailed && (
            <div className="py-8 text-center" data-testid="task-unavailable">
              <p className="text-sm text-muted-foreground">{t("taskUnavailable")}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
                {t("close")}
              </Button>
            </div>
          )}
          {!loading && task && (
            <div className="mb-4 space-y-1.5">
              <Label htmlFor="task-status">{t("statusLabel")}</Label>
              <Select
                value={task.status}
                onValueChange={(v) => void handleStatusChange(v as TaskStatus)}
                disabled={saving}
              >
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "backlog" ? t("backlog") : t(`column.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!loading && task && (
            <TaskForm
              initial={task}
              isSaving={saving}
              onSubmit={handleUpdate}
              onCancel={onClose}
            />
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
