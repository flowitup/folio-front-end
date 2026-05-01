"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Trash2, ChevronRight, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Invoice, InvoiceType } from "@/types/invoice";
import { fetchInvoices, deleteInvoice } from "@/lib/api/invoice-api";
import { InvoiceDetailRow } from "@/components/invoices/invoice-detail-row";
import { InvoiceExportDialog } from "@/components/invoices/invoice-export-dialog";

type TabType = "all" | InvoiceType;

// Number of <th> columns in the invoice table — used for the inline detail
// row's colSpan so it spans the full width. Update if columns change.
const INVOICE_TABLE_COLUMN_COUNT = 7;

const TYPE_STAMP_CLASS: Record<InvoiceType, string> = {
  client: "stamp",
  labor: "stamp accent",
  supplier: "stamp positive",
};

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const projectId = params.id as string;
  const { user } = useAuth();

  // The selected invoice id lives in `?invoice=<id>` so the modal is deep-linkable
  const selectedInvoiceId = searchParams.get("invoice");

  /**
   * URL strategy: use push() for the initial open (none → some) so the back
   * button closes the inline panel, matching modal-style expectations. Use
   * replace() for swaps and close to avoid history pollution from rapid toggling.
   */
  const setSelected = (next: string | null, isInitialOpen: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("invoice", next);
    else params.delete("invoice");
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (isInitialOpen) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  /** Toggle: clicking the open row collapses it; clicking another swaps. */
  const toggleInvoice = (id: string) => {
    if (selectedInvoiceId === id) {
      setSelected(null, false);
    } else {
      // First-time open (no previous selection) gets a history entry; swap doesn't.
      setSelected(id, selectedInvoiceId === null);
    }
  };

  const closeInvoice = () => setSelected(null, false);

  const canManageInvoices =
    user?.permissions?.some(
      (p) => p === "project:manage_invoices" || p === "*:*" || p === "project:*"
    ) ?? false;

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchInvoices(
        projectId,
        activeTab !== "all" ? activeTab : undefined
      );
      setInvoices(data);
    } catch {
      setError("Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, activeTab]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteInvoice(projectId, invoice.id);
      await loadInvoices();
    } catch {
      setError("Failed to delete invoice");
    }
  };

  const tabs: TabType[] = ["all", "client", "labor", "supplier"];

  // Compute KPIs from current invoice list
  const formatEUR = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
  const paidInvoices = invoices.filter((i) => (i as { status?: string }).status === "paid");
  const pendingInvoices = invoices.filter((i) => (i as { status?: string }).status === "pending");
  const overdueInvoices = invoices.filter((i) => (i as { status?: string }).status === "overdue");
  const paidTotal = paidInvoices.reduce((s, i) => s + i.total_amount, 0);
  const pendingTotal = pendingInvoices.reduce((s, i) => s + i.total_amount, 0);
  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="fade-up space-y-6 px-8 pb-12">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="folio-card p-5">
          <div className="label-cap">{t("totalInvoiced")}</div>
          <div className="font-display num mt-2 text-[28px] font-medium leading-none">
            {formatEUR(totalInvoiced)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: invoices.length })}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("paid")}</div>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: "var(--positive)" }}
          >
            {formatEUR(paidTotal)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: paidInvoices.length })}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("pending")}</div>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: "var(--warning)" }}
          >
            {formatEUR(pendingTotal)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("awaiting", { n: pendingInvoices.length })}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("overdue")}</div>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: overdueInvoices.length > 0 ? "var(--negative)" : "var(--ink)" }}
          >
            {formatEUR(overdueTotal)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("invoiceCount", { n: overdueInvoices.length })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="seg">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "on" : ""}
            >
              {tab === "all" ? t("all") : t(`types.${tab}`)}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setExportOpen(true)}>
          <Download className="mr-2 h-4 w-4" />
          {t("export.trigger")}
        </Button>
      </div>

      <InvoiceExportDialog
        projectId={projectId}
        open={exportOpen}
        onOpenChange={setExportOpen}
        initialType={activeTab}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {!isLoading && (
        <div className="folio-card overflow-hidden">
          {invoices.length === 0 ? (
            <div
              className="flex items-center justify-center py-12 text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {t("noInvoices")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>{t("invoiceNumber")}</th>
                    <th>{t("type")}</th>
                    <th>{t("issueDate")}</th>
                    <th>{t("recipient")}</th>
                    <th style={{ textAlign: "right" }}>{t("totalAmount")}</th>
                    <th style={{ textAlign: "right" }}>{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const isOpen = selectedInvoiceId === invoice.id;
                    const detailId = `invoice-detail-${invoice.id}`;
                    return (
                      <Fragment key={invoice.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          className="cursor-pointer"
                          style={isOpen ? { background: "var(--paper-2)" } : undefined}
                          onClick={() => toggleInvoice(invoice.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleInvoice(invoice.id);
                            }
                          }}
                        >
                          <td style={{ color: "var(--muted)" }}>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="num text-[12.5px]">{invoice.invoice_number}</td>
                          <td>
                            <span className={TYPE_STAMP_CLASS[invoice.type]}>
                              {t(`types.${invoice.type}`)}
                            </span>
                          </td>
                          <td className="num" style={{ color: "var(--muted)" }}>
                            {invoice.issue_date}
                          </td>
                          <td>{invoice.recipient_name}</td>
                          <td className="num font-medium" style={{ textAlign: "right" }}>
                            {invoice.total_amount.toFixed(2)}
                          </td>
                          <td
                            style={{ textAlign: "right" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {canManageInvoices && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  style={{ color: "var(--muted)" }}
                                  onClick={() => handleDelete(invoice)}
                                >
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <InvoiceDetailRow
                            projectId={projectId}
                            invoiceId={invoice.id}
                            canManage={canManageInvoices}
                            colSpan={INVOICE_TABLE_COLUMN_COUNT}
                            regionId={detailId}
                            onMutated={loadInvoices}
                            onCollapse={closeInvoice}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
