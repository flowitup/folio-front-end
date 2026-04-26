"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/planning/task-form";
import { fetchTask, updateTask, deleteTask } from "@/lib/api/task-api";
import type { Task, UpdateTaskPayload } from "@/types/task";

interface TaskDetailDrawerProps {
  /** Currently selected task id from `?task=<id>`; null when closed. */
  taskId: string | null;
  /** Optional in-memory task seed (skips fetch if provided). */
  seed?: Task | null;
  onClose: () => void;
  onMutated?: () => void;
}

/**
 * Right-side slide-in drawer (custom, no shadcn Sheet dep). Backdrop click +
 * Escape close. Fetches task on open unless a seed is provided.
 */
export function TaskDetailDrawer({ taskId, seed, onClose, onMutated }: TaskDetailDrawerProps) {
  const t = useTranslations("planning");
  const [task, setTask] = useState<Task | null>(seed ?? null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    fetchTask(taskId)
      .then((t) => { if (!cancelled) setTask(t); })
      .catch(() => { if (!cancelled) setTask(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId, seed]);

  // Esc to close
  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(t("deleteConfirm"))) return;
    await deleteTask(task.id);
    onMutated?.();
    onClose();
  };

  if (!taskId) return null;

  return (
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
            {task && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
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
    </>
  );
}
