"use client";

/**
 * Right-side detail drawer for the Timeline/Category expense views (design
 * Expense redesign — phase 03). Desktop-only — below `lg` the component
 * doesn't mount at all (tracked via `matchMedia("(min-width: 1024px)")`),
 * so its body scroll-lock and Esc listener never run on mobile, where the
 * mobile card list keeps its own inline detail path. The match is read
 * lazily in an effect (default `false`) so the SSR/initial render never
 * mounts the drawer; a `change` listener releases the scroll-lock and
 * unmounts the drawer immediately on a desktop→mobile resize.
 *
 * The body reuses `InvoiceDetailRow` (asCard mode) unmodified — the same
 * surface the mobile card list and the split view mount — so attachments,
 * edit, delete, and transfer-to-company keep working without a fork. That
 * surface already renders its own type/number/print/edit/delete action bar;
 * this shell only adds what it's missing: a persistent close affordance and
 * a quick-glance identity strip while the body scrolls.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, X } from "lucide-react";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";

const DESKTOP_QUERY = "(min-width: 1024px)";

interface ExpenseDetailDrawerProps {
  /** The selected invoice (from the already-loaded list), or null when closed. */
  invoice: Invoice | null;
  projectId: string;
  canManageInvoices: boolean;
  companyName: string | null;
  typeStampClass: Record<InvoiceType, string>;
  onMutated: () => void;
  onClose: () => void;
}

export function ExpenseDetailDrawer({
  invoice,
  projectId,
  canManageInvoices,
  companyName,
  typeStampClass,
  onMutated,
  onClose,
}: ExpenseDetailDrawerProps) {
  const t = useTranslations("invoices");

  // Track viewport via matchMedia rather than CSS-only hiding, so the
  // scroll-lock/Esc effects below never run below `lg` in the first place.
  // Default false is SSR-safe; the real value is read on mount.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    // Sync from an external source (the viewport) that isn't knowable during
    // SSR/first render — mirrors the localStorage-read pattern used for the
    // view-variant default elsewhere on this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const open = invoice !== null && isDesktop;

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Body scroll-lock while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc closes — but not when a Radix dialog (e.g. the export dialog) is
  // stacked on top of us; let that dialog handle its own Escape first. Our
  // own panel never sets `data-state`, so it never matches this query.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Minimal focus management (full trap intentionally waived): move focus
  // into the panel on open, restore it to whatever had focus before on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open || !invoice) return null;

  return (
    <div data-testid="expense-detail-drawer">
      <button
        type="button"
        aria-label={t("drawer.close")}
        className="fixed inset-0 z-40"
        style={{
          background: "rgba(26,26,26,0.4)",
          backdropFilter: "blur(2px)",
          animation: "backdrop-in 160ms ease both",
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={invoice.invoice_number}
        className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-full flex-col"
        style={{
          width: 480,
          background: "var(--paper)",
          borderLeft: "1px solid var(--line)",
          boxShadow: "-24px 0 48px -24px rgba(26,26,26,0.3)",
          animation: "drawer-in 200ms ease both",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={typeStampClass[invoice.type]}>{t(`types.${invoice.type}`)}</span>
            <span className="num truncate text-[13px]" style={{ color: "var(--muted)" }}>
              {invoice.invoice_number}
            </span>
            {invoice.is_auto_generated && (
              <span className="stamp flex-none" style={{ fontSize: 9.5, padding: "2px 7px" }}>
                <Lock size={9} className="mr-0.5 inline" />
                {t("auto")}
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("drawer.close")}
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <InvoiceDetailRow
            projectId={projectId}
            invoiceId={invoice.id}
            canManage={canManageInvoices}
            colSpan={1}
            onMutated={onMutated}
            onCollapse={onClose}
            companyName={companyName}
            asCard
          />
        </div>
      </div>
    </div>
  );
}
