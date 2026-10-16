"use client";

import { useState, useMemo, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { MonthField, isMonthValue } from "@/components/ui/month-picker";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchLaborExport, fetchWorkerLaborExport, formatEUR } from "@/lib/api/labor";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { ApiError } from "@/lib/api/http";
import { rateLimitMessage, retryAfterOf } from "@/lib/api/rate-limit";
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

/** "octobre 2026" in the app's language (not the browser's). */
function formatMonth(ym: string, locale: string): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(y, m - 1, 1),
    );
  } catch {
    return ym;
  }
}

/** The current month, "YYYY-MM": the default export period. */
function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function computeMonthSpan(from: string, to: string): number {
  if (!isMonthValue(from) || !isMonthValue(to)) return 0;
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
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
      // Without a pre-fill, the period is the current month (never two empty fields).
      setFrom(initialFrom || thisMonth());
      setTo(initialTo || thisMonth());
      setFormat(initialFormat ?? "xlsx");
      setSelectedWorkerId(initialWorkerId ?? "");
    }
  }, [open, initialFrom, initialTo, initialFormat, initialWorkerId]);

  const monthSpan = useMemo(() => computeMonthSpan(from, to), [from, to]);
  const formatInvalid = (!!from && !isMonthValue(from)) || (!!to && !isMonthValue(to));
  const rangeInvalid = !from || !to || formatInvalid || from > to || monthSpan > 24;

  // Resolve the worker the export will target across all three modes.
  const pickedWorker = pickerMode
    ? (workers!.find((w) => w.id === selectedWorkerId) ?? null)
    : null;
  const effectiveWorkerId = pickerMode ? selectedWorkerId : worker?.id;
  // In worker/picker mode a worker must be resolved; project-wide mode needs none.
  const needsWorker = pickerMode || worker !== undefined;
  const canSubmit = !rangeInvalid && !submitting && (needsWorker ? !!effectiveWorkerId : true);

  const rangeError: string | null = formatInvalid
    ? tCommon("monthPicker.formatError")
    : from && to && from > to
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
          locale,
        ));
        triggerBrowserDownload(blob, filename);
        toast.success(t("workerToastSuccess"), { id: toastId });
      } else {
        ({ blob, filename } = await fetchLaborExport(
          projectId,
          { from, to },
          format,
          locale,
        ));
        triggerBrowserDownload(blob, filename);
        toast.success(t("downloaded"), { id: toastId });
      }
      handleClose();
    } catch (err) {
      // Translated, never ApiError's raw "Export failed: 403"; a 429 says how long to wait.
      toast.error(
        err instanceof ApiError && err.status === 429
          ? rateLimitMessage(tCommon, retryAfterOf(err))
          : needsWorker
            ? t("workerToastError")
            : t("errorGeneric"),
        { id: toastId },
      );
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
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {worker
              ? t("workerDialogTitle", { name: worker.person_name ?? worker.name })
              : t("dialogTitle")}
          </DialogTitle>
          {/* The rate in force today (after any rate change), as on the worker
              tile — daily_rate is only the rate the worker was created with. */}
          {subtitleWorker && (
            <p className="text-sm text-muted-foreground pt-1">
              {t("workerSubtitle", {
                rate: formatEUR(subtitleWorker.current_daily_rate ?? subtitleWorker.daily_rate),
              })}
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

          {pickerMode ? (
            /* Picker mode: the month is fixed to the one being viewed — show it
               read-only (no range selection). */
            <div className="space-y-2">
              <Label>{t("month")}</Label>
              <p className="text-sm font-medium">{formatMonth(from, locale)}</p>
            </div>
          ) : (
            <>
              {/* Date range pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={fromId}>{t("from")}</Label>
                  <MonthField
                    id={fromId}
                    value={from}
                    onChange={setFrom}
                    aria-invalid={!!from && !isMonthValue(from)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={toId}>{t("to")}</Label>
                  <MonthField
                    id={toId}
                    value={to}
                    onChange={setTo}
                    aria-invalid={!!to && !isMonthValue(to)}
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
            </>
          )}

          {/* Format selector — toggle buttons */}
          <div className="space-y-2">
            <Label>{t("format")}</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={format === "xlsx" ? "default" : "outline"}
                size="sm"
                aria-pressed={format === "xlsx"}
                onClick={() => setFormat("xlsx")}
              >
                {t("xlsx")}
              </Button>
              <Button
                type="button"
                variant={format === "pdf" ? "default" : "outline"}
                size="sm"
                aria-pressed={format === "pdf"}
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
