"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchLaborExport, fetchWorkerLaborExport, formatEUR } from "@/lib/api/labor";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import type { Worker } from "@/types/labor";
import type { LaborExportFormat } from "@/types/labor";

interface LaborExportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, dialog exports for this specific worker instead of the whole project. */
  worker?: Worker | null;
}

function computeMonthSpan(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function LaborExportDialog({
  projectId,
  open,
  onOpenChange,
  worker,
}: LaborExportDialogProps) {
  const t = useTranslations("labor.export");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [format, setFormat] = useState<LaborExportFormat>("xlsx");
  const [submitting, setSubmitting] = useState(false);

  const monthSpan = useMemo(() => computeMonthSpan(from, to), [from, to]);
  const rangeInvalid = !from || !to || from > to || monthSpan > 24;
  // When worker mode: also require worker to be non-null
  const canSubmit = !rangeInvalid && !submitting && (worker !== undefined ? !!worker : true);

  const rangeError: string | null =
    from && to && from > to
      ? t("errorRangeInvalid")
      : monthSpan > 24
        ? t("errorRangeTooLarge")
        : null;

  const handleClose = () => {
    if (submitting) return;
    setFrom("");
    setTo("");
    setFormat("xlsx");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const toastId = toast.loading(t("generating"));
    try {
      let blob: Blob;
      let filename: string;
      if (worker) {
        ({ blob, filename } = await fetchWorkerLaborExport(
          projectId,
          worker.id,
          { from, to },
          format,
        ));
        triggerBrowserDownload(blob, filename);
        toast.success(t("workerToastSuccess"), { id: toastId });
      } else {
        ({ blob, filename } = await fetchLaborExport(
          projectId,
          { from, to },
          format,
        ));
        triggerBrowserDownload(blob, filename);
        toast.success(t("downloaded"), { id: toastId });
      }
      handleClose();
    } catch (err) {
      const fallbackKey = worker ? t("workerToastError") : t("errorGeneric");
      toast.error(err instanceof Error ? err.message : fallbackKey, {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // In worker mode: don't render if both worker is absent and dialog is closed
  if (worker !== undefined && !worker && !open) return null;

  const isOpen = worker !== undefined ? open && !!worker : open;
  const fromId = worker ? "worker-export-from" : "export-from";
  const toId = worker ? "worker-export-to" : "export-to";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {worker
              ? t("workerDialogTitle", { name: worker.person_name ?? worker.name })
              : t("dialogTitle")}
          </DialogTitle>
          {worker && (
            <p className="text-sm text-muted-foreground pt-1">
              {t("workerSubtitle", { rate: formatEUR(worker.daily_rate) })}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date range pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={fromId}>{t("from")}</Label>
              <Input
                id={fromId}
                type="month"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={toId}>{t("to")}</Label>
              <Input
                id={toId}
                type="month"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          {/* Range error */}
          {rangeError && (
            <p role="alert" className="text-sm" style={{ color: "var(--destructive)" }}>
              {rangeError}
            </p>
          )}

          {/* Summary line */}
          {from && to && !rangeInvalid && monthSpan > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("summaryLine", { count: monthSpan })}
            </p>
          )}

          {/* Format selector — toggle buttons */}
          <div className="space-y-2">
            <Label>{t("format")}</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={format === "xlsx" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("xlsx")}
              >
                {t("xlsx")}
              </Button>
              <Button
                type="button"
                variant={format === "pdf" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormat("pdf")}
              >
                {t("pdf")}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? t("generating") : t("download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
