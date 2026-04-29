"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, UserX, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Worker } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";
import { WorkerLaborExportDialog } from "@/components/labor/worker-labor-export-dialog";

interface WorkerListProps {
  workers: Worker[];
  canManage: boolean;
  projectId: string;
  onAdd: () => void;
  onEdit: (worker: Worker) => void;
  onDeactivate: (worker: Worker) => void;
}

export function WorkerList({
  workers,
  canManage,
  projectId,
  onAdd,
  onEdit,
  onDeactivate,
}: WorkerListProps) {
  const t = useTranslations("labor");
  const tExport = useTranslations("labor.export");
  const [confirmDeactivate, setConfirmDeactivate] = useState<Worker | null>(null);
  const [exportWorker, setExportWorker] = useState<Worker | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t("workers")}</h3>
        {canManage && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            {t("addWorker")}
          </Button>
        )}
      </div>

      {/* Worker List */}
      {workers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("noWorkers")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {workers.map((worker) => (
            <Card key={worker.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{worker.name}</span>
                    <Badge variant={worker.is_active ? "default" : "secondary"}>
                      {worker.is_active ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatEUR(worker.daily_rate)}/jour</span>
                    {worker.phone && <span>{worker.phone}</span>}
                  </div>
                </div>

                {worker.is_active && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={tExport("exportWorker")}
                      onClick={() => setExportWorker(worker)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(worker)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeactivate(worker)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Per-worker export dialog */}
      <WorkerLaborExportDialog
        projectId={projectId}
        worker={exportWorker}
        open={!!exportWorker}
        onOpenChange={(o) => !o && setExportWorker(null)}
      />

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <UserX className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">
              {t("confirmDeactivate")}
            </AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              {confirmDeactivate?.name}
            </p>
          </div>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeactivate) {
                  onDeactivate(confirmDeactivate);
                  setConfirmDeactivate(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deactivateWorker")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
