"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Awaited before close so the caller's refetch (or local-state update)
  // has a chance to fail loudly rather than silently after the dialog goes.
  onUpdated?: (project: Project) => void | Promise<void>;
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onUpdated,
}: EditProjectDialogProps) {
  const t = useTranslations("projects");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from project when dialog opens or when a different project is loaded.
  // Using project?.id (not the object reference) prevents re-syncing on identity churn.
  useEffect(() => {
    if (open && project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name);
      setAddress(project.address ?? "");
      setError(null);
      setIsSubmitting(false);
    }
  }, [project?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isSubmitting) {
      onOpenChange(false);
    } else if (isOpen) {
      onOpenChange(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setError(t("editProjectNameRequired"));
      return;
    }

    const payload = {
      name: trimmedName,
      address: trimmedAddress || null,
    };

    // No-op: close without API call if nothing changed
    if (payload.name === project.name && payload.address === project.address) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await updateProject(project.id, payload);
      // Wait for caller-side reconciliation (e.g. refetch) BEFORE we close,
      // so a refetch failure surfaces while the dialog is still up.
      await onUpdated?.(updated);
      onOpenChange(false);
    } catch {
      setError(t("editProjectError"));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editProjectTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">{t("projectName")}</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projectNamePlaceholder")}
              maxLength={255}
              autoFocus
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-project-address">
              {t("projectAddressOptional")}
            </Label>
            <Input
              id="edit-project-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("projectAddressPlaceholder")}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
