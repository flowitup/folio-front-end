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
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/auth/permissions";
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
  const { user } = useAuth();
  // Financing side: without `project:view_budget` the backend both withholds
  // the figure and refuses a PUT that carries it, so the fields are hidden AND
  // left out of the payload — otherwise a plain rename would come back 403.
  const canViewBudget = can("project:view_budget", user?.permissions, project?.my_permissions);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetSource, setBudgetSource] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from project when dialog opens or when a different project is loaded.
  // Using project?.id (not the object reference) prevents re-syncing on identity churn.
  useEffect(() => {
    if (open && project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(project.name);
      setAddress(project.address ?? "");
      setBudget(project.budget != null ? String(project.budget) : "");
      setBudgetSource(project.budget_source ?? "");
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
    const trimmedBudgetStr = budget.trim();
    const trimmedBudgetSource = budgetSource.trim();

    if (!trimmedName) {
      setError(t("editProjectNameRequired"));
      return;
    }

    // Resolve budget: empty string → null (clear); non-empty → parse
    let budgetValue: number | null | undefined;
    if (trimmedBudgetStr === "") {
      budgetValue = null;
    } else {
      const parsed = parseFloat(trimmedBudgetStr);
      if (isNaN(parsed) || parsed < 0) {
        setError(t("budgetInvalid"));
        return;
      }
      budgetValue = parsed;
    }

    const budgetSourceValue = trimmedBudgetSource || null;

    const payload = {
      name: trimmedName,
      address: trimmedAddress || null,
      ...(canViewBudget ? { budget: budgetValue, budget_source: budgetSourceValue } : {}),
    };

    // No-op: close without API call if nothing changed
    const existingBudget = project.budget ?? null;
    const existingBudgetSource = project.budget_source ?? null;
    const budgetUnchanged =
      !canViewBudget ||
      (payload.budget === existingBudget && payload.budget_source === existingBudgetSource);
    if (
      payload.name === project.name &&
      payload.address === project.address &&
      budgetUnchanged
    ) {
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

          {canViewBudget && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-project-budget">{t("budgetLabel")}</Label>
                <Input
                  id="edit-project-budget"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-project-budget-source">
                  {t("budgetSourceLabelOptional")}
                </Label>
                <Input
                  id="edit-project-budget-source"
                  value={budgetSource}
                  onChange={(e) => setBudgetSource(e.target.value)}
                  placeholder={t("budgetSourcePlaceholder")}
                  maxLength={120}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

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
