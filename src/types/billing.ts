/**
 * Billing domain types — devis (quote) and facture (invoice) documents.
 * Decimal values are transported as strings to avoid floating-point precision loss.
 * FE does best-effort live-preview math via Number() + Intl.NumberFormat;
 * the server (Python Decimal) is authoritative for all stored totals.
 */

export type BillingDocumentKind = "devis" | "facture";

export type BillingDocumentStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "paid"
  | "overdue"
  | "cancelled";

export interface BillingDocumentItem {
  description: string;
  quantity: string; // Decimal-as-string
  unit_price: string; // Decimal-as-string
  vat_rate: string; // Decimal-as-string (percent, e.g. "20")
  /** Phase 05 — grouping category (e.g. "Toiture"). Optional/null for legacy items. */
  category?: string | null;
  /** Optional unit label (e.g. "m²", "ft"). Stored by BE on suggestions. */
  unit?: string | null;
}

export interface VatBreakdownEntry {
  rate: string; // Decimal-as-string
  base_ht: string;
  tva_amount: string;
}

export interface BillingDocument {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: BillingDocumentKind;
  document_number: string;
  status: BillingDocumentStatus;
  issue_date: string; // YYYY-MM-DD
  validity_until: string | null;
  payment_due_date: string | null;
  payment_terms: string | null;
  recipient_name: string;
  recipient_address: string | null;
  recipient_email: string | null;
  recipient_siret: string | null;
  notes: string | null;
  terms: string | null;
  signature_block_text: string | null;
  items: BillingDocumentItem[];
  issuer_legal_name: string;
  issuer_address: string;
  issuer_siret: string | null;
  issuer_tva_number: string | null;
  issuer_iban: string | null;
  issuer_bic: string | null;
  issuer_logo_url: string | null;
  source_devis_id: string | null;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  vat_breakdown: VatBreakdownEntry[];
  created_at: string;
  updated_at: string;
}

export interface BillingDocumentTemplate {
  id: string;
  user_id: string;
  kind: BillingDocumentKind;
  name: string;
  notes: string | null;
  terms: string | null;
  default_vat_rate: string | null;
  items: BillingDocumentItem[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Request payload types
// ---------------------------------------------------------------------------

export interface CreateBillingDocumentPayload {
  kind: BillingDocumentKind;
  /** Required — which company to bill from. Phase 08 (billing form picker) populates this. */
  company_id: string;
  project_id?: string | null;
  recipient_name: string;
  recipient_address?: string | null;
  recipient_email?: string | null;
  recipient_siret?: string | null;
  items: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  signature_block_text?: string | null;
  validity_until?: string | null;
  payment_due_date?: string | null;
  payment_terms?: string | null;
  issue_date?: string | null;
}

export interface UpdateBillingDocumentPayload {
  project_id?: string | null;
  recipient_name?: string;
  recipient_address?: string | null;
  recipient_email?: string | null;
  recipient_siret?: string | null;
  items?: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  signature_block_text?: string | null;
  validity_until?: string | null;
  payment_due_date?: string | null;
  payment_terms?: string | null;
  issue_date?: string | null;
}

export interface CloneBillingDocumentPayload {
  override_kind?: BillingDocumentKind | null;
  /** Optional — defaults to caller's primary company if omitted. */
  company_id?: string | null;
}

export interface ConvertDevisToFacturePayload {
  payment_due_date?: string | null;
  payment_terms?: string | null;
  /** Optional — defaults to caller's primary company if omitted. */
  company_id?: string | null;
}

export interface UpdateBillingDocumentStatusPayload {
  new_status: BillingDocumentStatus;
}

export interface ApplyTemplatePayload {
  recipient_name: string;
  recipient_address?: string | null;
  recipient_email?: string | null;
  recipient_siret?: string | null;
  project_id?: string | null;
  issue_date?: string | null;
  /** Optional — defaults to caller's primary company if omitted. */
  company_id?: string | null;
}

export interface CreateBillingTemplatePayload {
  kind: BillingDocumentKind;
  name: string;
  items: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  default_vat_rate?: string | null;
}

export interface UpdateBillingTemplatePayload {
  name?: string;
  items?: BillingDocumentItem[];
  notes?: string | null;
  terms?: string | null;
  default_vat_rate?: string | null;
}

