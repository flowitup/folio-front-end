"use client";

/**
 * TagManager — CRUD UI for project-scoped phase tags.
 * Create / edit / delete tags with a color picker (mirrors RoleColorPicker).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { createTagAction, updateTagAction, deleteTagAction } from "@/app/[locale]/(app)/projects/[id]/tags/actions";
import type { ProjectTag } from "@/lib/api/tags";

// ---- Color palette (mirrors labor-role palette) ----

const DEFAULT_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
  "#84cc16", // lime
  "#14b8a6", // teal
  "#f59e0b", // amber
];

interface TagColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function TagColorPicker({ value, onChange }: TagColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DEFAULT_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={cn(
            "h-7 w-7 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === color && "ring-2 ring-offset-2 ring-primary",
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && (
            <span className="flex h-full w-full items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- Tag row ----

interface TagRowProps {
  tag: ProjectTag;
  onEdit: (tag: ProjectTag) => void;
  onDelete: (tag: ProjectTag) => void;
}

function TagRow({ tag, onEdit, onDelete }: TagRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-2.5">
      <span
        className="h-4 w-4 flex-shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
        aria-hidden="true"
      />
      <span className="flex-1 text-sm font-medium">{tag.name}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(tag)}
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(tag)}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---- TagForm dialog (create + edit) ----

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  editTag: ProjectTag | null;
  onSaved: (tag: ProjectTag) => void;
}

function TagFormDialog({
  open,
  onOpenChange,
  projectId,
  editTag,
  onSaved,
}: TagFormDialogProps) {
  const t = useTranslations("tags");
  const [name, setName] = useState(editTag?.name ?? "");
  const [color, setColor] = useState(editTag?.color ?? DEFAULT_PALETTE[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with a (different) tag.
  // Using key on Dialog to force remount is simpler; we reset here too.
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(editTag?.name ?? "");
      setColor(editTag?.color ?? DEFAULT_PALETTE[0]);
      setError(null);
    }
    onOpenChange(v);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("form.nameRequired"));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      let result;
      if (editTag) {
        result = await updateTagAction(projectId, editTag.id, name, color);
      } else {
        result = await createTagAction(projectId, name, color);
      }
      if (!result.success) {
        setError(
          result.error === "duplicate"
            ? t("errors.duplicate")
            : t("errors.generic"),
        );
        return;
      }
      onSaved(result.tag);
      onOpenChange(false);
      toast.success(editTag ? t("toast.updated") : t("toast.created"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editTag ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">{t("form.name")}</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("form.namePlaceholder")}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>{t("form.color")}</Label>
            <TagColorPicker value={color} onChange={setColor} />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("form.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main TagManager ----

interface TagManagerProps {
  projectId: string;
  initialTags: ProjectTag[];
}

export function TagManager({ projectId, initialTags }: TagManagerProps) {
  const t = useTranslations("tags");
  const [tags, setTags] = useState<ProjectTag[]>(initialTags);
  const [showForm, setShowForm] = useState(false);
  const [editTag, setEditTag] = useState<ProjectTag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreate() {
    setEditTag(null);
    setShowForm(true);
  }

  function openEdit(tag: ProjectTag) {
    setEditTag(tag);
    setShowForm(true);
  }

  function handleSaved(tag: ProjectTag) {
    setTags((prev) => {
      const idx = prev.findIndex((t) => t.id === tag.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tag;
        return next;
      }
      return [...prev, tag];
    });
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteTagAction(projectId, deleteTarget.id);
      if (result.success) {
        setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        toast.success(t("toast.deleted"));
      } else {
        toast.error(t("errors.generic"));
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("manager.title")}</h2>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          {t("manager.addTag")}
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("manager.empty")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("manager.createFirst")}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <TagFormDialog
        key={editTag?.id ?? "new"}
        open={showForm}
        onOpenChange={setShowForm}
        projectId={projectId}
        editTag={editTag}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("delete.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
