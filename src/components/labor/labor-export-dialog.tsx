"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** Fixed-worker mode: export for this specific worker (no picker shown). */
  worker?: Worker | null;
  /** Picker mode: when provided, the dialog shows a worker selector so the user
   *  chooses which person to export — independent of any outer filter. */
  workers?: Worker[];
  /** Picker mode: pre-select this worker id when the dialog opens. */
  initialWorkerId?: string;
  /** Optional pre-fill values. When the dialog opens these seed the from/to/format state.
   *  Existing callers that pass no initial props get the same defaults as before ("" / "" / "xlsx"). */
  initialFrom?: string;
  initialTo?: string;
  initialFormat?: LaborExportFormat;
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
  workers,
  initialWorkerId,
  initialFrom,
  initialTo,
  initialFormat,
}: LaborExportDialogProps) {
  const t = useTranslations("labor.export");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [format, setFormat] = useState<LaborExportFormat>("xlsx");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Picker mode is active when a `workers` list is supplied (the export chooses
  // its own worker via the dropdown rather than inheriting an outer filter).
  const pickerMode = Array.isArray(workers);

  // Seed state from pre-fill props each time the dialog opens.
  useEffect(() => {
    if (open) {
      setFrom(initialFrom ?? "");
      setTo(initialTo ?? "");
      setFormat(initialFormat ?? "xlsx");
      setSelectedWorkerId(initialWorkerId ?? "");
    }
  }, [open, initialFrom, initialTo, initialFormat, initialWorkerId]);

  const monthSpan = useMemo(() => computeMonthSpan(from, to), [from, to]);
  const rangeInvalid = !from || !to || from > to || monthSpan > 24;

  // Resolve the worker the export will target across all three modes.
  const pickedWorker = pickerMode
    ? (workers!.find((w) => w.id === selectedWorkerId) ?? null)
    : null;
  const effectiveWorkerId = pickerMode ? selectedWorkerId : worker?.id;
  // In worker/picker mode a worker must be resolved; project-wide mode needs none.
  const needsWorker = pickerMode || worker !== undefined;
  const canSubmit = !rangeInvalid && !submitting && (needsWorker ? !!effectiveWorkerId : true);

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
    setSelectedWorkerId("");
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const toastId = toast.loading(t("generating"));
    try {
      let blob: Blob;
      let filename: string;
      if (effectiveWorkerId) {
        ({ blob, filename } = await fetchWorkerLaborExport(
          projectId,
          effectiveWorkerId,
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
      const fallbackKey = needsWorker ? t("workerToastError") : t("errorGeneric");
      toast.error(err instanceof Error ? err.message : fallbackKey, {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Fixed-worker mode: don't render if the worker is absent and the dialog is closed.
  if (worker !== undefined && !worker && !open) return null;

  const isOpen = worker !== undefined ? open && !!worker : open;
  const fromId = pickerMode ? "picker-export-from" : worker ? "worker-export-from" : "export-from";
  const toId = pickerMode ? "picker-export-to" : worker ? "worker-export-to" : "export-to";

  // Rate subtitle shows for the fixed worker, or the picked worker once chosen.
  const subtitleWorker = worker ?? pickedWorker;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {worker
              ? t("workerDialogTitle", { name: worker.person_name ?? worker.name })
              : t("dialogTitle")}
          </DialogTitle>
          {subtitleWorker && (
            <p className="text-sm text-muted-foreground pt-1">
              {t("workerSubtitle", { rate: formatEUR(subtitleWorker.daily_rate) })}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Worker picker — only in picker mode */}
          {pickerMode && (
            <div className="space-y-2">
              <Label htmlFor="picker-export-worker">{t("workerField")}</Label>
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger id="picker-export-worker">
                  <SelectValue placeholder={t("workerPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {workers!.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.person_name ?? w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
