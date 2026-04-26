"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES } from "@/types/task";
import type { CreateTaskPayload, Task, TaskPriority } from "@/types/task";

interface TaskFormProps {
  initial?: Task;
  isSaving?: boolean;
  onSubmit: (payload: CreateTaskPayload) => void;
  onCancel: () => void;
}

/**
 * Reusable form for create + edit. On create, parent passes no `initial`
 * and provides project_id externally; on edit, populated from the task entity.
 */
export function TaskForm({ initial, isSaving, onSubmit, onCancel }: TaskFormProps) {
  const t = useTranslations("planning");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [labelsInput, setLabelsInput] = useState((initial?.labels ?? []).join(", "));

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? "");
      setPriority(initial.priority);
      setDueDate(initial.due_date ?? "");
      setLabelsInput(initial.labels.join(", "));
    }
  }, [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || null,
      labels: labelsInput
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input
          id="title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <textarea
          id="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("priorityLabel")}</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="due-date">{t("dueDateLabel")}</Label>
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="labels">{t("labelsLabel")}</Label>
        <Input
          id="labels"
          value={labelsInput}
          onChange={(e) => setLabelsInput(e.target.value)}
          placeholder={t("labelsPlaceholder")}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSaving || !title.trim()}>
          {isSaving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
