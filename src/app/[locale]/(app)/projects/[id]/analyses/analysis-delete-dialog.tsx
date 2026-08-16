"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteAnalysisAction } from "./_actions/analyses-actions";
import type { ProjectAnalysis } from "@/lib/api/project-analyses";

// ---- Props ----

type Props = {
  projectId: string;
  analysis: ProjectAnalysis | null;
  onCancel: () => void;
  onDeleted: (analysisId: string) => void;
};

// ---- Component ----

export function AnalysisDeleteDialog({ projectId, analysis, onCancel, onDeleted }: Props) {
  const t = useTranslations("analyses.delete");
  const tErrors = useTranslations("analyses.errors");
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (!analysis) return;
    setDeleting(true);
    try {
      const result = await deleteAnalysisAction(projectId, analysis.id);
      if (result.ok) {
        toast.success(t("success"));
        onDeleted(analysis.id);
      } else {
        toast.error(tErrors(result.error as Parameters<typeof tErrors>[0]));
        onCancel();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={analysis !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmBody", { title: analysis?.title ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={deleting}>
            {t("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={deleting}
          >
            {deleting ? t("confirming") : t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
