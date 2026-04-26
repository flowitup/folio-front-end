"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { InvoiceDetailContent } from "@/components/invoices/invoice-detail-content";
import { fetchInvoice } from "@/lib/api/invoice-api";
import type { Invoice } from "@/types/invoice";

interface InvoiceDetailRowProps {
  projectId: string;
  invoiceId: string;
  canManage: boolean;
  /** Number of columns in the parent table — used for `colSpan` on the wrapper td. */
  colSpan: number;
  /** id used by the parent row's `aria-controls` to link disclosure trigger ↔ region. */
  regionId?: string;
  /** Called when the underlying invoice changed (after edit) so list can refresh. */
  onMutated?: () => void;
  /** Called when the row should collapse (after delete). */
  onCollapse?: () => void;
}

/**
 * Renders an invoice's detail body inline as a table row that expands below
 * its parent row. Uses a CSS grid-rows-[0fr→1fr] transition for a smooth
 * slide-down animation without measuring heights or external animation libs.
 */
export function InvoiceDetailRow({
  projectId,
  invoiceId,
  canManage,
  colSpan,
  regionId,
  onMutated,
  onCollapse,
}: InvoiceDetailRowProps) {
  const locale = useLocale();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mount-then-flip pattern: render with grid 0fr on first paint, then flip
  // to 1fr on the next animation frame so CSS transitions the height open.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Clear any prior error and fetch — both paths set state inside the
    // promise callback so we don't trigger react-hooks/set-state-in-effect.
    fetchInvoice(projectId, invoiceId)
      .then((data) => {
        if (cancelled) return;
        setInvoice(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load invoice");
      });
    return () => { cancelled = true; };
  }, [projectId, invoiceId]);

  return (
    <tr className="border-b last:border-0 bg-muted/10" id={regionId} role="region">
      <td colSpan={colSpan} className="p-0">
        {/* CSS-only slide-down via grid-rows transition (no JS height measurement). */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="p-6 border-l-2 border-primary">
              {!invoice && !error && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {error && (
                <div className="py-4 text-sm text-destructive">{error}</div>
              )}
              {invoice && (
                <InvoiceDetailContent
                  invoice={invoice}
                  canManage={canManage}
                  onUpdated={(u) => { setInvoice(u); onMutated?.(); }}
                  onDeleted={() => { onMutated?.(); onCollapse?.(); }}
                  printUrl={`/${locale}/projects/${projectId}/invoices/${invoice.id}/print`}
                />
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
