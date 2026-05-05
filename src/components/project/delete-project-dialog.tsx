"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";

interface DeleteProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (deletedId: string) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProjectDialogProps) {
  const t = useTranslations("projects");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens for a new project; skip reset while deleting.
  useEffect(() => {
    if (!isDeleting) {
      setConfirmText("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, open]);

  if (!project) return null;

  const handleDelete = async () => {
    if (!project || confirmText.trim() !== project.name) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteProject(project.id);
      onDeleted?.(project.id);
      onOpenChange(false);
    } catch {
      setError(t("deleteProjectError"));
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isDeleting && onOpenChange(o)}>
      <AlertDialogContent className="max-w-sm sm:max-w-md">
        {/* Header — centered icon over negative-tint circle, then title + project name */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--negative-tint)" }}
          >
            <Trash2 size={20} style={{ color: "var(--negative)" }} />
          </div>
          <div className="space-y-1 text-center">
            <AlertDialogTitle className="font-display text-center">
              {t("deleteProjectTitle")}
            </AlertDialogTitle>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {project.name}
            </p>
          </div>
        </div>

        {/* Body — irreversible warning + cascade copy + billing note */}
        <div className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
          <p style={{ color: "var(--negative)" }}>{t("deleteProjectIrreversible")}</p>
          <p>{t("deleteProjectCascade")}</p>
          <p>{t("deleteProjectBillingNote")}</p>
        </div>

        {/* Confirmation input — t.rich not used in this codebase; using inline <strong> fallback */}
        <div className="space-y-2">
          <Label htmlFor="delete-project-confirm">
            {t("deleteProjectTypeToConfirm")} <strong>{project.name}</strong>
          </Label>
          <Input
            id="delete-project-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t("deleteProjectTypePlaceholder")}
            disabled={isDeleting}
            autoComplete="off"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter className="gap-2 sm:justify-center">
          <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmText.trim() !== project.name || isDeleting}
            style={{ background: "var(--negative)", color: "white" }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("deleting")}
              </>
            ) : (
              t("delete")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
