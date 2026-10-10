"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "@/components/planning/task-form";
import { toast } from "sonner";
import { createTask } from "@/lib/api/task-api";
import { taskErrorKey } from "@/lib/planning/task-error";
import type { CreateTaskPayload, TaskAssignee, TaskStatus } from "@/types/task";

interface TaskCreateDialogProps {
  open: boolean;
  projectId: string;
  /** The lane the user clicked "+" on; pre-fills `status`. */
  defaultStatus: TaskStatus;
  /** Pre-fills the due date (week view's per-day "+"); null/undefined = blank. */
  defaultDueDate?: string | null;
  /** Project members offered by the assignee picker. */
  assignees?: TaskAssignee[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/**
 * Modal for creating a new task. Detail view uses the side drawer; this is a
 * dialog because creation is a quick one-off and doesn't benefit from
 * keeping the board visible.
 */
export function TaskCreateDialog({
  open,
  projectId,
  defaultStatus,
  defaultDueDate,
  assignees,
  onOpenChange,
  onCreated,
}: TaskCreateDialogProps) {
  const t = useTranslations("planning");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (payload: CreateTaskPayload) => {
    setSaving(true);
    try {
      await createTask(projectId, { ...payload, status: defaultStatus });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      // Keep the dialog open with what was typed, and say why.
      toast.error(t(`errors.${taskErrorKey(err, "create")}`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The title says it all; no description (silences Radix's warning). */}
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("newTask")}</DialogTitle>
        </DialogHeader>
        <TaskForm
          // Remount when the prefilled due date changes so the form re-seeds
          // (week view reuses the same dialog instance across different days).
          key={defaultDueDate ?? "none"}
          defaultDueDate={defaultDueDate}
          assignees={assignees}
          isSaving={saving}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
