"use client";

/**
 * Row-highlight color picker for an invoice/expense.
 *
 * A compact popover of palette swatches plus a "clear" action. Selecting a color
 * PATCHes the invoice's highlight_color and reports the updated invoice back so
 * the list can re-tint. Modeled on TransferToCompanyPaymentAction (ghost icon
 * button, in-flight disable, toast on error).
 *
 * Rendered in two places (desktop row actions cell + expanded detail action bar)
 * for both one-click and in-detail access; gate placement on canManage &&
 * !is_auto_generated at the call site, mirroring Edit/Delete.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Highlighter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateInvoice } from "@/lib/api/invoice-api";
import { HIGHLIGHT_COLORS, highlightSwatch } from "@/lib/invoices/highlight-colors";
import { ApiError } from "@/lib/api/http";
import type { HighlightColor, Invoice } from "@/types/invoice";

interface InvoiceHighlightPickerProps {
  invoice: Invoice;
  /** Called with the updated invoice after a successful PATCH. */
  onUpdated: (updated: Invoice) => void;
}

export function InvoiceHighlightPicker({ invoice, onUpdated }: InvoiceHighlightPickerProps) {
  const t = useTranslations("invoices");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const current = invoice.highlight_color ?? null;

  async function apply(color: HighlightColor | null) {
    setLoading(true);
    try {
      const updated = await updateInvoice(invoice.project_id, invoice.id, { highlight_color: color });
      onUpdated(updated);
      setOpen(false);
    } catch (err) {
      const backendMsg =
        err instanceof ApiError
          ? ((err.data as Record<string, unknown> | undefined)?.message as string | undefined)
          : undefined;
      toast.error(backendMsg?.trim() || t("highlight.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          style={{ color: current ? highlightSwatch(current) : "var(--muted)" }}
          aria-label={t("highlight.label")}
          title={t("highlight.label")}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Highlighter size={13} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {HIGHLIGHT_COLORS.map((color) => {
            const selected = current === color;
            return (
              <button
                key={color}
                type="button"
                disabled={loading}
                onClick={() => apply(color)}
                aria-label={t(`highlight.colors.${color}`)}
                aria-pressed={selected}
                title={t(`highlight.colors.${color}`)}
                className="flex h-6 w-6 items-center justify-center rounded-full ring-offset-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                style={{
                  backgroundColor: highlightSwatch(color),
                  boxShadow: selected ? "0 0 0 2px var(--ring, #94a3b8)" : undefined,
                }}
              >
                {selected && <Check size={13} color="#ffffff" />}
              </button>
            );
          })}
          <button
            type="button"
            disabled={loading || current === null}
            onClick={() => apply(null)}
            aria-label={t("highlight.clear")}
            title={t("highlight.clear")}
            className="ml-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            {t("highlight.clear")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
