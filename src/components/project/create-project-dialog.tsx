"use client";

import { useState } from "react";
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
import { createProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const t = useTranslations("projects");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetSource, setBudgetSource] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAddress("");
    setBudget("");
    setBudgetSource("");
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isSubmitting) {
      reset();
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("createProjectNameRequired"));
      return;
    }

    const budgetNum = budget.trim() ? parseFloat(budget.trim()) : undefined;
    if (budgetNum !== undefined && (isNaN(budgetNum) || budgetNum < 0)) {
      setError(t("budgetInvalid"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        name: trimmed,
        address: address.trim() ? address.trim() : null,
        ...(budgetNum !== undefined && { budget: budgetNum }),
        ...(budgetSource.trim() && { budget_source: budgetSource.trim() }),
      });
      onCreated?.(project);
      reset();
      onOpenChange(false);
    } catch {
      setError(t("createProjectError"));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createProjectTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-project-name">{t("projectName")}</Label>
            <Input
              id="create-project-name"
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
            <Label htmlFor="create-project-address">
              {t("projectAddressOptional")}
            </Label>
            <Input
              id="create-project-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("projectAddressPlaceholder")}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-project-budget">{t("budgetLabel")}</Label>
            <Input
              id="create-project-budget"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-project-budget-source">
              {t("budgetSourceLabelOptional")}
            </Label>
            <Input
              id="create-project-budget-source"
              value={budgetSource}
              onChange={(e) => setBudgetSource(e.target.value)}
              placeholder={t("budgetSourcePlaceholder")}
              maxLength={120}
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
                  {t("creating")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
