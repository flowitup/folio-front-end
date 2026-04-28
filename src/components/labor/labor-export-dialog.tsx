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
import { fetchLaborExport } from "@/lib/api/labor";
import type { LaborExportFormat } from "@/types/labor";

interface LaborExportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function computeMonthSpan(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke so the browser can finish the download trigger
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function LaborExportDialog({
  projectId,
  open,
  onOpenChange,
}: LaborExportDialogProps) {
  const t = useTranslations("labor.export");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [format, setFormat] = useState<LaborExportFormat>("xlsx");
  const [submitting, setSubmitting] = useState(false);

  const monthSpan = useMemo(() => computeMonthSpan(from, to), [from, to]);
  const rangeInvalid = !from || !to || from > to || monthSpan > 24;
  const canSubmit = !rangeInvalid && !submitting;

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
      const { blob, filename } = await fetchLaborExport(
        projectId,
        { from, to },
        format,
      );
      triggerBrowserDownload(blob, filename);
      toast.success(t("downloaded"), { id: toastId });
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"), {
        id: toastId,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date range pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="export-from">{t("from")}</Label>
              <Input
                id="export-from"
                type="month"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-to">{t("to")}</Label>
              <Input
                id="export-to"
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

          {/* Format selector — toggle buttons (no radio-group primitive) */}
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
