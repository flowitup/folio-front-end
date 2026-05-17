// Invoice management types

export type InvoiceType = "released_funds" | "labor" | "materials_services";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  type: InvoiceType;
  issue_date: string;
  recipient_name: string;
  recipient_address: string | null;
  notes: string | null;
  items: InvoiceItem[];
  total_amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** UUID of the payment method selected when the invoice was written. */
  payment_method_id: string | null;
  /** Snapshot of the payment method label at write time (survives label renames/deletes). */
  payment_method_label: string | null;
  /** UUID of the billing document that triggered auto-creation. Null for manual entries. */
  source_billing_document_id: string | null;
  /** True if this entry was auto-generated from a billing payment. Read-only in the UI. */
  is_auto_generated: boolean;
}

export interface CreateInvoicePayload {
  type: InvoiceType;
  issue_date: string;
  recipient_name: string;
  recipient_address?: string;
  notes?: string;
  items: Omit<InvoiceItem, "total">[];
  /** Optional payment method UUID. Null or omitted = no payment method. */
  payment_method_id?: string | null;
}

export type UpdateInvoicePayload = Partial<Omit<CreateInvoicePayload, "type">>;

export interface InvoiceAttachment {
  id: string;
  invoice_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string | null;
  download_url: string;
}

// ─── Export types ─────────────────────────────────────────────────────────────

export type InvoiceExportFormat = "xlsx" | "pdf";

export interface InvoiceExportRange {
  from: string; // YYYY-MM
  to: string;   // YYYY-MM
}

export type InvoiceExportTypeFilter = InvoiceType | undefined;
