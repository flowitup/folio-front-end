"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, UserX, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { LaborExportDialog } from "@/components/labor/labor-export-dialog";
import { workerColor, personInitials } from "@/lib/utils/person-color";
import { DEFAULT_ROLE_I18N_KEYS } from "@/lib/utils/default-role-names";
import { cn } from "@/lib/utils";

/**
 * Avatar block — colored initials chip. Color is driven by the worker's
 * role_color when assigned, otherwise falls back to the deterministic
 * personColor hash so each worker has a stable visual identity.
 */
function WorkerAvatar({
  initials,
  color,
}: {
  initials: string;
  color: string;
}) {
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

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
  const tRole = useTranslations("labor.role.defaults");
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {workers.map((worker) => {
            // Prefer the joined Person identity once cook 1c backfill
            // links workers to persons; fall back to legacy fields.
            const displayName = worker.person_name ?? worker.name;
            return (
              <Card
                key={worker.id}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center gap-2 p-4 text-center transition",
                  "hover:border-primary/60 hover:shadow-md",
                  !worker.is_active && "opacity-60",
                )}
              >
                {/* Active indicator dot — top-left */}
                <span
                  className={cn(
                    "absolute left-3 top-3 inline-block h-2 w-2 rounded-full",
                    worker.is_active ? "bg-[var(--positive)]" : "bg-muted-foreground/40",
                  )}
                  title={worker.is_active ? t("active") : t("inactive")}
                  aria-label={worker.is_active ? t("active") : t("inactive")}
                />

                {/* Avatar — colored initials (color = role_color or hash) */}
                <WorkerAvatar
                  initials={personInitials(displayName)}
                  color={workerColor(worker)}
                />

                {/* Identity */}
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {displayName}
                  </p>
                  <p className="text-primary text-sm font-medium tabular-nums">
                    {formatEUR(worker.daily_rate)}
                  </p>
                  {/* Role badge */}
                  {worker.role_name && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: worker.role_color ?? undefined }}
                        aria-hidden="true"
                      />
                      {worker.role_id && DEFAULT_ROLE_I18N_KEYS[worker.role_id]
                        ? tRole(DEFAULT_ROLE_I18N_KEYS[worker.role_id])
                        : worker.role_name}
                    </span>
                  )}
                </div>

                {/* Action bar — visible on hover or focus-within */}
                {worker.is_active && (
                  <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={tExport("exportWorker")}
                      onClick={() => setExportWorker(worker)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("editWorker")}
                          onClick={() => onEdit(worker)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-7 w-7"
                          aria-label={t("deactivateWorker")}
                          onClick={() => setConfirmDeactivate(worker)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Per-worker export dialog */}
      <LaborExportDialog
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
              {confirmDeactivate?.person_name ?? confirmDeactivate?.name}
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
