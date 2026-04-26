// Invoice management types

export type InvoiceType = "client" | "labor" | "supplier";

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
}

export interface CreateInvoicePayload {
  type: InvoiceType;
  issue_date: string;
  recipient_name: string;
  recipient_address?: string;
  notes?: string;
  items: Omit<InvoiceItem, "total">[];
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
