"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { fetchInvoice } from "@/lib/api/invoice-api";
import type { Invoice, InvoiceType } from "@/types/invoice";

const TYPE_LABEL: Record<InvoiceType, string> = {
  released_funds: "Released Funds",
  labor: "Labor",
  materials_services: "Materials & Services",
  others: "Others",
};

export default function InvoicePrintPage() {
  const params = useParams();
  const projectId = params.id as string;
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvoice(projectId, invoiceId)
      .then((data) => { if (!cancelled) setInvoice(data); })
      .catch(() => { if (!cancelled) setError("Failed to load invoice"); });
    return () => { cancelled = true; };
  }, [projectId, invoiceId]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>{error}</div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ padding: "2rem", color: "#666" }}>Loading...</div>
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
        .company-tagline { font-size: 9pt; color: #666; margin-top: 2px; }
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
            Print / Save as PDF
          </button>
        </div>

        {/* Header */}
        <div className="header">
          <div className="company-name">Construction</div>
          <div className="company-tagline">Project Management</div>
          <div className="invoice-title">INVOICE</div>
        </div>

        {/* Invoice meta */}
        <table className="meta-table">
          <tbody>
            <tr>
              <td>Invoice #</td>
              <td>{invoice.invoice_number}</td>
            </tr>
            <tr>
              <td>Type</td>
              <td>{TYPE_LABEL[invoice.type]}</td>
            </tr>
            <tr>
              <td>Issue Date</td>
              <td>{invoice.issue_date}</td>
            </tr>
            <tr>
              <td>Recipient</td>
              <td>{invoice.recipient_name}</td>
            </tr>
            {invoice.recipient_address && (
              <tr>
                <td>Address</td>
                <td style={{ whiteSpace: "pre-line" }}>{invoice.recipient_address}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Line items */}
        <table className="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right" style={{ width: "80px" }}>Qty</th>
              <th className="right" style={{ width: "110px" }}>Unit Price</th>
              <th className="right" style={{ width: "110px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td>{item.description}</td>
                <td className="right">{item.quantity}</td>
                <td className="right">{item.unit_price.toFixed(2)}</td>
                <td className="right">{item.total.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={3} className="right">Grand Total</td>
              <td className="right">{invoice.total_amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        {invoice.notes && (
          <div className="notes-section">
            <div className="notes-label">Notes</div>
            <div className="notes-text">{invoice.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}
