// Invoice management types

export type InvoiceType = "released_funds" | "labor" | "materials_services" | "others" | "return";

/**
 * How a `return` invoice was settled: 'cash' = refunded out via bank/cash (no
 * link needed); 'avoir' = a supplier credit note applied against another
 * invoice. Only meaningful when type === 'return'.
 */
export type SettledVia = "cash" | "avoir";

/**
 * Fixed palette for the optional row-highlight color. Stored as a plain string;
 * null/absent means no highlight. Applies to invoices of every type. The BE
 * enforces the same palette (schema Literal + CHECK constraint).
 */
export type HighlightColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  /** VAT rate in percent (e.g. 20 means 20 %). Absent on legacy items — treat as 0. */
  vat_rate?: number;
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
  /** UUID of the billing document that triggered this auto-generated invoice. */
  source_billing_document_id: string | null;
  /** True when invoice was created automatically (e.g. facture → PAID funds release). */
  is_auto_generated: boolean;
  /** Optional phase tag UUID assigned to this invoice. */
  tag_id?: string | null;
  /**
   * Refund-tracking lifecycle for materials & services expenses.
   * null = not refund-tracked; non-null = in refund workflow.
   */
  refundable_status?: RefundableStatus | null;
  /**
   * True when this invoice was paid directly with a company-flagged payment method —
   * already company money, not eligible for the refund workflow.
   */
  paid_by_company?: boolean;
  /**
   * True when this invoice was paid with a personal-flagged payment method.
   * Mutually exclusive with paid_by_company. On released_funds auto-invoices,
   * drives whether the release is attributed to the company or personal card.
   */
  paid_by_personal?: boolean;
  /**
   * UUID of the materials_services invoice that this refund invoice is linked to.
   * Only set on type=refund invoices; null/absent = unlinked refund.
   */
  refunds_invoice_id?: string | null;
  /**
   * Invoice number of the linked M&S invoice (read-only enrichment from the backend).
   * Present when refunds_invoice_id is set.
   */
  refunds_invoice_number?: string;
  /**
   * True when ≥1 refund invoice links back to this materials_services expense
   * (refunded by bank). Backend-derived; always false for non-M&S invoices.
   * The company-refund signal rides on refundable_status === 'refunded'.
   */
  has_bank_refund?: boolean;
  /**
   * Which entity carried out the reimbursement. Only meaningful when
   * refundable_status === 'refunded' — null/absent on any other status
   * (the backend clears it server-side when the status leaves 'refunded').
   * Legacy 'refunded' rows written before this field existed read as null
   * and are treated as company-refunded for backward compatibility.
   */
  refunded_by?: RefundedBy | null;
  /**
   * Optional "payment for month" on labor expenses, format "YYYY-MM-01".
   * Only meaningful when type === "labor"; null on all other types and on
   * legacy labor invoices created before this field existed.
   */
  service_month: string | null;
  /**
   * How this return was settled — 'cash' or 'avoir' (supplier credit note).
   * null = not yet decided, or a legacy return row written before this field
   * existed. Only meaningful when type === 'return'.
   */
  settled_via?: SettledVia | null;
  /**
   * UUID of the invoice this avoir return is applied to ("paid with returns"
   * on that target). Only set when type === 'return' && settled_via ===
   * 'avoir'; null = unlinked ("outstanding" avoir).
   */
  applied_to_invoice_id?: string | null;
  /**
   * Invoice number of applied_to_invoice_id's target (read-only enrichment
   * from the backend). Present when applied_to_invoice_id is set.
   */
  applied_to_invoice_number?: string | null;
  /**
   * Avoir return invoices applied to THIS invoice (reverse of
   * applied_to_invoice_id) — i.e. what paid for it. Empty array when none.
   */
  paid_with_returns?: { invoice_number: string; total_amount: number }[];
  /**
   * UUID of the worker this labor invoice pays. Only meaningful when
   * type === "labor"; null/absent means the expense isn't linked to a
   * specific worker record (legacy rows, or intentionally left unlinked —
   * the FE shows a "Not linked" placeholder in that case). The backend
   * server-snapshots recipient_name from the worker's name whenever this
   * is set.
   */
  worker_id?: string | null;
  /**
   * Optional row-highlight color from the fixed palette. null/absent = no
   * highlight. Purely visual — the list row / card tints to this color.
   */
  highlight_color?: HighlightColor | null;
}

export interface CreateInvoicePayload {
  type: InvoiceType;
  issue_date: string;
  recipient_name: string;
  recipient_address?: string;
  notes?: string;
  items: Omit<InvoiceItem, "total">[];  // vat_rate is included via InvoiceItem (minus total)
  /** Optional payment method UUID. Null or omitted = no payment method. */
  payment_method_id?: string | null;
  /** Optional phase tag UUID. Null or omitted = no tag. */
  tag_id?: string | null;
  /**
   * UUID of the materials_services invoice this refund is linked to.
   * Only valid when type=refund. Null clears the link; omitted = keep existing (on update).
   */
  refunds_invoice_id?: string | null;
  /**
   * "Payment for month", format "YYYY-MM-01". Only valid when type=labor —
   * the backend returns 400 service_month_not_allowed otherwise.
   * Null clears the value; omitted = keep existing (on update).
   */
  service_month?: string | null;
  /**
   * How the return is settled — 'cash' or 'avoir'. Only valid when
   * type='return'. Null clears the field; omitted = keep existing (on update).
   */
  settled_via?: SettledVia | null;
  /**
   * UUID of the invoice this avoir return is applied to. Only valid when
   * type='return' && settled_via='avoir' — the backend rejects it otherwise.
   * Null clears the link; omitted = keep existing (on update).
   */
  applied_to_invoice_id?: string | null;
  /**
   * UUID of the worker this labor invoice pays. Only valid when type=labor —
   * the backend returns 400 worker_link_not_allowed otherwise, and
   * worker_not_in_project if the worker isn't on this project. Null clears
   * the link; omitted = keep existing (on update).
   */
  worker_id?: string | null;
  /**
   * Optional row-highlight color from the fixed palette. Null clears the
   * highlight; omitted = keep existing (on update). Valid on any invoice type.
   */
  highlight_color?: HighlightColor | null;
}

export type UpdateInvoicePayload = Partial<CreateInvoicePayload>;

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

// ─── Refundable expense types ──────────────────────────────────────────────────

/** Status lifecycle for a materials & services expense claimed for reimbursement. */
export type RefundableStatus = "refundable" | "refund_pending" | "refunded";

/** Which entity carried out a reimbursement: the company itself, or the bank/vendor. */
export type RefundedBy = "company" | "bank" | "both";

/**
 * A single file attached to a refundable expense invoice.
 * Subset of InvoiceAttachment — only the fields the backend sends on this endpoint.
 */
export interface RefundableExpenseAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

/**
 * A project invoice (type=materials_services) tracked across the company for
 * reimbursement. Returned by GET /billing/materials-expenses.
 */
export interface RefundableExpense {
  id: string;
  project_id: string;
  project_name: string;
  invoice_number: string;
  recipient_name: string;
  /** Issue date in YYYY-MM-DD format. */
  issue_date: string;
  total_amount: number;
  /** null means the expense has not been flagged for reimbursement yet. */
  refundable_status: RefundableStatus | null;
  /** True when ≥1 refund invoice links back to this expense (refunded by bank). */
  has_bank_refund: boolean;
  /**
   * Which entity carried out the reimbursement. Only meaningful when
   * refundable_status === 'refunded' — null/absent on any other status
   * (the backend clears it server-side when the status leaves 'refunded').
   * Legacy 'refunded' rows written before this field existed read as null
   * and are treated as company-refunded for backward compatibility.
   */
  refunded_by?: RefundedBy | null;
  /**
   * invoice_number (FR-YYYY-NNNN) of the auto-generated released_funds entry
   * created when this expense was marked refunded by the bank. Absent/null when
   * no release is linked — including on responses from before the field existed.
   */
  funds_release_number?: string | null;
  /** Invoice files attached to this expense, ordered by upload time. */
  attachments: RefundableExpenseAttachment[];
}

/**
 * Aggregated refund totals for the full filter set behind
 * GET /billing/materials-expenses?refundable=true — not just the current page.
 */
export interface RefundableSummary {
  refundable_amount: number;
  refunded_total: number;
  /** Refunded expenses involving the company ('company', legacy null, or 'both'). */
  refunded_by_company: number;
  /** Refunded expenses involving the bank ('bank' or 'both'). */
  refunded_by_bank: number;
  /** Overlap: expenses refunded by both sides (already included in each figure above). */
  refunded_by_both: number;
}
