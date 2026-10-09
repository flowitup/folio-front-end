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
import type { CreateTaskPayload, Task, TaskAssignee, TaskPriority } from "@/types/task";

/** Radix Select items cannot carry an empty value; this one stands for "nobody". */
const UNASSIGNED = "__unassigned__";

/** The API's limits (tasks/schemas.py): checked here so the form names the field at fault. */
const MAX_DESCRIPTION = 5000;
const MAX_LABELS = 20;
const MAX_LABEL_LENGTH = 50;

/** Comma-separated labels, trimmed; a repeat (ignoring case) keeps its first spelling. */
export function parseLabels(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((l) => l.trim())
    .filter((l) => {
      const key = l.toLowerCase();
      if (!l || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

interface TaskFormProps {
  initial?: Task;
  /** Create-mode pre-fill for the due date (e.g. week view's per-day "+"). */
  defaultDueDate?: string | null;
  /** Project members offered by the assignee picker. */
  assignees?: TaskAssignee[];
  isSaving?: boolean;
  onSubmit: (payload: CreateTaskPayload) => void;
  onCancel: () => void;
  /** Edit mode: told whether the fields differ from `initial`, so closing can warn. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Reusable form for create + edit. On create, parent passes no `initial`
 * and provides project_id externally; on edit, populated from the task entity.
 *
 * The fields are seeded once: the parent remounts the form (`key`) for another
 * task. Re-seeding whenever `initial` changed threw away unsaved typing as soon
 * as the drawer stored a fresh copy of the same task (a status change, a board
 * refresh).
 */
export function TaskForm({
  initial,
  defaultDueDate,
  assignees = [],
  isSaving,
  onSubmit,
  onCancel,
  onDirtyChange,
}: TaskFormProps) {
  const t = useTranslations("planning");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  // Edit target (`initial`) wins; otherwise seed from the create-mode prefill.
  const [dueDate, setDueDate] = useState(initial?.due_date ?? defaultDueDate ?? "");
  const [labelsInput, setLabelsInput] = useState((initial?.labels ?? []).join(", "));
  const [assigneeId, setAssigneeId] = useState<string | null>(initial?.assignee_id ?? null);
  const [labelsError, setLabelsError] = useState<string | null>(null);

  // Someone the member list does not name (an admin who is not on the team,
  // a person since removed) stays selectable, so saving does not unassign them.
  const keptAssigneeId = initial?.assignee_id ?? null;
  const assigneeOptions =
    keptAssigneeId && !assignees.some((a) => a.id === keptAssigneeId)
      ? [...assignees, { id: keptAssigneeId, name: t("assigneeOther") }]
      : assignees;

  const dirty =
    !!initial &&
    (title.trim() !== initial.title.trim() ||
      description.trim() !== (initial.description ?? "").trim() ||
      priority !== initial.priority ||
      dueDate !== (initial.due_date ?? "") ||
      assigneeId !== (initial.assignee_id ?? null) ||
      parseLabels(labelsInput).join(",") !== initial.labels.join(","));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const labels = parseLabels(labelsInput);
    // Counted in code points, as the API (Python) does: an emoji is one character, not two.
    const tooLong = labels.find((l) => Array.from(l).length > MAX_LABEL_LENGTH);
    if (labels.length > MAX_LABELS || tooLong) {
      setLabelsError(
        tooLong
          ? t("labelTooLong", { max: MAX_LABEL_LENGTH, label: tooLong })
          : t("labelsTooMany", { max: MAX_LABELS })
      );
      return;
    }
    // Editing: an emptied description is sent as null so it is cleared, not
    // left out of the payload (which read as "unchanged").
    const emptyDescription = initial ? null : undefined;
    // The assignee goes out only when it changed (null unassigns), so a save
    // of other fields never touches it.
    const assigneeChanged = assigneeId !== (initial?.assignee_id ?? null);
    onSubmit({
      title: title.trim(),
      description: description.trim() || emptyDescription,
      priority,
      due_date: dueDate || null,
      labels,
      ...(assigneeChanged ? { assignee_id: assigneeId } : {}),
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
          maxLength={255}
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
          maxLength={MAX_DESCRIPTION}
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
        <Label htmlFor="task-assignee">{t("assigneeLabel")}</Label>
        <Select
          value={assigneeId ?? UNASSIGNED}
          onValueChange={(v) => setAssigneeId(v === UNASSIGNED ? null : v)}
        >
          <SelectTrigger id="task-assignee" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>{t("unassigned")}</SelectItem>
            {assigneeOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="labels">{t("labelsLabel")}</Label>
        <Input
          id="labels"
          value={labelsInput}
          onChange={(e) => {
            setLabelsInput(e.target.value);
            setLabelsError(null);
          }}
          placeholder={t("labelsPlaceholder")}
          aria-invalid={labelsError ? true : undefined}
          aria-describedby={labelsError ? "labels-error" : undefined}
        />
        {labelsError && (
          <p id="labels-error" role="alert" className="text-[12px] text-destructive [overflow-wrap:anywhere]">
            {labelsError}
          </p>
        )}
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
