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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";
import type { UserCompanySummary } from "@/lib/auth/permissions";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
  /**
   * Companies the caller administers. A single-company admin gets no picker
   * — the backend defaults to their one company (unchanged behavior). An
   * admin of 2+ companies gets a required picker so the project lands in
   * the intended company instead of always the primary one.
   */
  adminCompanies?: UserCompanySummary[];
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
  adminCompanies = [],
}: CreateProjectDialogProps) {
  const t = useTranslations("projects");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [budgetSource, setBudgetSource] = useState("");
  const needsCompanyPicker = adminCompanies.length > 1;
  const defaultCompanyId =
    (adminCompanies.find((c) => c.is_primary) ?? adminCompanies[0])?.id ?? "";
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAddress("");
    setBudget("");
    setBudgetSource("");
    setCompanyId(defaultCompanyId);
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

    if (needsCompanyPicker && !companyId) {
      setError(t("createProjectCompanyRequired"));
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
        // Single-company admins never set companyId (no picker rendered) —
        // omit it entirely so the backend keeps defaulting to their one
        // company, unchanged from before this fix.
        ...(needsCompanyPicker && companyId && { company_id: companyId }),
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

          {needsCompanyPicker && (
            <div className="space-y-2">
              <Label htmlFor="create-project-company">{t("createProjectCompanyLabel")}</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isSubmitting}>
                <SelectTrigger id="create-project-company">
                  <SelectValue placeholder={t("createProjectCompanyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {adminCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
