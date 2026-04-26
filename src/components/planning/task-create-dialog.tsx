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
import { createTask } from "@/lib/api/task-api";
import type { CreateTaskPayload, TaskStatus } from "@/types/task";

interface TaskCreateDialogProps {
  open: boolean;
  projectId: string;
  /** The lane the user clicked "+" on; pre-fills `status`. */
  defaultStatus: TaskStatus;
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newTask")}</DialogTitle>
        </DialogHeader>
        <TaskForm
          isSaving={saving}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
