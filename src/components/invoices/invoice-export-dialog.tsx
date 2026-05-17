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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fetchInvoiceExport } from "@/lib/api/invoice-api";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import type { InvoiceExportFormat, InvoiceType } from "@/types/invoice";

interface InvoiceExportDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial type filter (carries through from the active list tab). */
  initialType?: InvoiceType | "all";
}

function computeMonthSpan(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function InvoiceExportDialog({
  projectId,
  open,
  onOpenChange,
  initialType = "all",
}: InvoiceExportDialogProps) {
  const t = useTranslations("invoices.export");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [format, setFormat] = useState<InvoiceExportFormat>("xlsx");
  const [typeValue, setTypeValue] = useState<InvoiceType | "all">(initialType);
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
    setTypeValue(initialType);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const toastId = toast.loading(t("generating"));
    try {
      const typeFilter = typeValue === "all" ? undefined : typeValue;
      const { blob, filename } = await fetchInvoiceExport(
        projectId,
        { from, to },
        format,
        typeFilter,
      );
      triggerBrowserDownload(blob, filename);
      toast.success(t("downloaded"), { id: toastId });
      handleClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("errorGeneric"),
        { id: toastId },
      );
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
              <Label htmlFor="invoice-export-from">{t("from")}</Label>
              <Input
                id="invoice-export-from"
                type="month"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-export-to">{t("to")}</Label>
              <Input
                id="invoice-export-to"
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

          {/* Type filter */}
          <div className="space-y-2">
            <Label htmlFor="invoice-export-type">{t("typeFilter")}</Label>
            <Select
              value={typeValue}
              onValueChange={(val) => setTypeValue(val as InvoiceType | "all")}
            >
              <SelectTrigger id="invoice-export-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("typeAll")}</SelectItem>
                <SelectItem value="released_funds">{t("typeReleasedFunds")}</SelectItem>
                <SelectItem value="labor">{t("typeLabor")}</SelectItem>
                <SelectItem value="supplier">{t("typeSupplier")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
