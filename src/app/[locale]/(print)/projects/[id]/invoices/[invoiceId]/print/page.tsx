"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { fetchInvoice } from "@/lib/api/invoice-api";
import { formatDate, formatEUR, formatMonthYear } from "@/lib/utils/formatters";
import type { Invoice } from "@/types/invoice";
import { ledgerTypeOf } from "@/lib/invoices/group-invoices-by-month";

export default function InvoicePrintPage() {
  const params = useParams();
  const projectId = params.id as string;
  const invoiceId = params.invoiceId as string;
  const t = useTranslations("invoices");
  const locale = useLocale();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInvoice(projectId, invoiceId)
      .then((data) => { if (!cancelled) setInvoice(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [projectId, invoiceId]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>{t("print.loadFailed")}</div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ padding: "2rem", color: "#666" }}>{t("print.loading")}</div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; font-size: 12pt; color: #111; background: #fff; }
        .page { max-width: 800px; margin: 0 auto; padding: 2rem; }
        .header { border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .company-name { font-size: 20pt; font-weight: 700; letter-spacing: -0.5px; }
        .invoice-title { font-size: 16pt; font-weight: 600; margin-top: 0.5rem; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
        .meta-table td { padding: 4px 8px 4px 0; font-size: 10pt; vertical-align: top; }
        .meta-table td:first-child { font-weight: 600; color: #555; width: 140px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .items-table th { background: #f5f5f5; border: 1px solid #ddd; padding: 6px 10px; font-size: 10pt; text-align: left; }
        .items-table th.right, .items-table td.right { text-align: right; }
        .items-table td { border: 1px solid #ddd; padding: 6px 10px; font-size: 10pt; }
        .items-table tr:nth-child(even) td { background: #fafafa; }
        .total-row td { background: #f0f0f0 !important; font-weight: 700; border-top: 2px solid #999; }
        .notes-section { margin-top: 1.5rem; border-top: 1px solid #ddd; padding-top: 1rem; }
        .notes-label { font-size: 9pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .notes-text { font-size: 10pt; white-space: pre-line; }
        .print-btn { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 1.5rem; padding: 8px 16px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .print-btn:hover { background: #333; }
        @media print {
          @page { margin: 15mm; size: A4; }
          body { font-size: 11pt; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page">
        {/* Print button — hidden when printing */}
        <div className="no-print">
          <button className="print-btn" onClick={() => window.print()}>
            {t("printPdf")}
          </button>
        </div>

        {/* Header */}
        <div className="header">
          <div className="company-name">Folio</div>
          <div className="invoice-title">{t("print.heading")}</div>
        </div>

        {/* Invoice meta */}
        <table className="meta-table">
          <tbody>
            <tr>
              <td>{t("invoiceNumber")}</td>
              <td>{invoice.invoice_number}</td>
            </tr>
            <tr>
              <td>{t("type")}</td>
              {/* Same label as the xlsx/pdf export: a cash advance is listed under
                  Others and flagged so it is not read as an expense. */}
              <td>
                {t(`types.${ledgerTypeOf(invoice)}`)}
                {invoice.is_cash_advance ? ` (${t("cashAdvance.badge")})` : ""}
              </td>
            </tr>
            <tr>
              <td>{t("issueDate")}</td>
              <td>{formatDate(invoice.issue_date)}</td>
            </tr>
            {invoice.service_month && (
              <tr>
                <td>{t("serviceMonth")}</td>
                <td>{formatMonthYear(invoice.service_month, locale)}</td>
              </tr>
            )}
            <tr>
              <td>{t("recipient")}</td>
              <td>{invoice.recipient_name}</td>
            </tr>
            {invoice.recipient_address && (
              <tr>
                <td>{t("recipientAddress")}</td>
                <td style={{ whiteSpace: "pre-line" }}>{invoice.recipient_address}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Line items */}
        {(() => {
          // Show VAT column only when at least one item carries a non-zero rate.
          const hasVat = invoice.items.some((it) => (it.vat_rate ?? 0) > 0);
          const totalHt = invoice.items.reduce(
            (s, it) => s + it.quantity * it.unit_price,
            0
          );
          const totalVat = invoice.items.reduce(
            (s, it) => s + it.quantity * it.unit_price * ((it.vat_rate ?? 0) / 100),
            0
          );
          const colCount = hasVat ? 5 : 4;

          return (
            <table className="items-table">
              <thead>
                <tr>
                  <th>{t("description")}</th>
                  <th className="right" style={{ width: "80px" }}>{t("quantity")}</th>
                  <th className="right" style={{ width: "110px" }}>{t("unitPrice")}</th>
                  {hasVat && <th className="right" style={{ width: "70px" }}>{t("colTva")} %</th>}
                  <th className="right" style={{ width: "110px" }}>{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td className="right">{item.quantity}</td>
                    <td className="right">{formatEUR(item.unit_price)}</td>
                    {hasVat && (
                      <td className="right">
                        {(item.vat_rate ?? 0) > 0 ? `${item.vat_rate}%` : "—"}
                      </td>
                    )}
                    <td className="right">{formatEUR(item.total)}</td>
                  </tr>
                ))}
                {hasVat ? (
                  <>
                    <tr>
                      <td colSpan={colCount - 1} className="right" style={{ fontWeight: "normal", color: "#555" }}>
                        {t("totalHt")}
                      </td>
                      <td className="right">{formatEUR(totalHt)}</td>
                    </tr>
                    <tr>
                      <td colSpan={colCount - 1} className="right" style={{ fontWeight: "normal", color: "#555" }}>
                        {t("totalTva")}
                      </td>
                      <td className="right">{formatEUR(totalVat)}</td>
                    </tr>
                    <tr className="total-row">
                      <td colSpan={colCount - 1} className="right">{t("totalTtc")}</td>
                      <td className="right">{formatEUR(invoice.total_amount)}</td>
                    </tr>
                  </>
                ) : (
                  <tr className="total-row">
                    <td colSpan={colCount - 1} className="right">{t("total")}</td>
                    <td className="right">{formatEUR(invoice.total_amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          );
        })()}

        {/* Notes */}
        {invoice.notes && (
          <div className="notes-section">
            <div className="notes-label">{t("notes")}</div>
            <div className="notes-text">{invoice.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}
