"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { InvoiceDetailContent } from "@/components/invoices/invoice-detail-content";
import { fetchInvoice } from "@/lib/api/invoice-api";
import { fetchProjectById } from "@/lib/api/projects";
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
  /** Render as a plain div instead of a table row (for mobile card layout). */
  asCard?: boolean;
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
  asCard,
}: InvoiceDetailRowProps) {
  const locale = useLocale();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
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
    // Fetch invoice and project company_id in parallel
    Promise.all([
      fetchInvoice(projectId, invoiceId),
      fetchProjectById(projectId).catch(() => null),
    ])
      .then(([invoiceData, projectData]) => {
        if (cancelled) return;
        setInvoice(invoiceData);
        setCompanyId(projectData?.company_id ?? null);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load invoice");
      });
    return () => { cancelled = true; };
  }, [projectId, invoiceId]);

  const content = (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">
        <div className={asCard ? "" : "p-6 border-l-2 border-primary"}>
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
              companyId={companyId}
              onUpdated={(u) => { setInvoice(u); onMutated?.(); }}
              onDeleted={() => { onMutated?.(); onCollapse?.(); }}
              printUrl={`/${locale}/projects/${projectId}/invoices/${invoice.id}/print`}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (asCard) {
    return <div id={regionId} role="region">{content}</div>;
  }

  return (
    <tr className="border-b last:border-0 bg-muted/10" id={regionId} role="region">
      <td colSpan={colSpan} className="p-0">
        {content}
      </td>
    </tr>
  );
}
