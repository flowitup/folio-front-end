import { api, ApiError, getCsrfHeader } from "@/lib/api/http";
import { env } from "@/lib/config/env";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import type {
  Invoice,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  InvoiceAttachment,
  InvoiceExportFormat,
  InvoiceExportRange,
  InvoiceExportTypeFilter,
} from "@/types/invoice";

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  funds_released_total: number;
  /**
   * Portion of funds_released_total paid via company-flagged (or unflagged/no-method)
   * payment methods. Optional: absent on an old BE build during a FE-deploys-first
   * window, when page.tsx falls back to `?? 0`.
   */
  funds_released_company_total?: number;
  /**
   * Portion of funds_released_total paid via personal-flagged payment methods.
   * Optional: same FE-before-BE deploy-ordering caveat as funds_released_company_total.
   */
  funds_released_personal_total?: number;
  /** Total amount spent directly by the company (via company-flagged payment methods) across this project. */
  company_spent_total: number;
  /**
   * Total amount spent personally (via personal-flagged payment methods) across this
   * project. Optional: same FE-before-BE deploy-ordering caveat as the split fields above.
   */
  personal_spent_total?: number;
  /**
   * Company money handed to a person (released_funds rows flagged is_cash_advance).
   * Kept OUT of the funds_released_* totals and of company_spent_total by the backend;
   * the company purse card adds it to its spend. Optional: same FE-before-BE
   * deploy-ordering caveat as the split fields above.
   */
  company_cash_advanced_total?: number;
  /** Name of the construction company associated with this project, if any. */
  company_name: string | null;
}

export const fetchInvoicesWithMeta = (
  projectId: string,
  type?: string,
  tagId?: string,
  /** Filter to labor invoices for a given "payment for month" (YYYY-MM-01). */
  serviceMonth?: string,
  /** Filter to labor invoices linked to a specific worker UUID. */
  workerId?: string
): Promise<InvoiceListResponse> => {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (tagId) params.set("tag_id", tagId);
  if (serviceMonth) params.set("service_month", serviceMonth);
  if (workerId) params.set("worker_id", workerId);
  const qs = params.toString();
  return api.get<InvoiceListResponse>(
    `/projects/${projectId}/invoices${qs ? `?${qs}` : ""}`
  );
};

export const fetchInvoice =(projectId: string, invoiceId: string): Promise<Invoice> =>
  api.get<Invoice>(`/projects/${projectId}/invoices/${invoiceId}`);

export const createInvoice = (
  projectId: string,
  payload: CreateInvoicePayload
): Promise<Invoice> =>
  api.post<Invoice, CreateInvoicePayload>(`/projects/${projectId}/invoices`, payload);

export const updateInvoice = (
  projectId: string,
  invoiceId: string,
  payload: UpdateInvoicePayload
): Promise<Invoice> =>
  api.put<Invoice, UpdateInvoicePayload>(`/projects/${projectId}/invoices/${invoiceId}`, payload);

export const deleteInvoice = (projectId: string, invoiceId: string): Promise<void> =>
  api.delete<void>(`/projects/${projectId}/invoices/${invoiceId}`);

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const fetchAttachments = (projectId: string, invoiceId: string): Promise<InvoiceAttachment[]> =>
  api.get<InvoiceAttachment[]>(`/projects/${projectId}/invoices/${invoiceId}/attachments`);

export const uploadAttachment = async (
  projectId: string,
  invoiceId: string,
  file: File
): Promise<InvoiceAttachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${env.apiBaseUrl}/projects/${projectId}/invoices/${invoiceId}/attachments`,
    {
      method: "POST",
      headers: {
        ...getCsrfHeader("POST"),
      },
      credentials: "include",
      body: formData,
    }
  );

  if (!response.ok) {
    let data: unknown;
    try { data = await response.json(); } catch { data = await response.text(); }
    throw new ApiError(`Upload failed: ${response.status}`, response.status, data);
  }
  return response.json();
};

export const deleteAttachment = (attachmentId: string): Promise<void> =>
  api.delete<void>(`/attachments/${attachmentId}`);

/**
 * Rename an attachment's display filename. The extension must be preserved
 * (the backend rejects an extension change). Returns the updated metadata.
 */
export const renameAttachment = (attachmentId: string, filename: string): Promise<InvoiceAttachment> =>
  api.patch<InvoiceAttachment, { filename: string }>(`/attachments/${attachmentId}/rename`, { filename });

/**
 * Fetch attachment as a raw Blob.
 */
export const fetchAttachmentBlob = async (attachmentId: string): Promise<Blob> => {
  const response = await fetch(`${env.apiBaseUrl}/attachments/${attachmentId}/download`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(`Download failed: ${response.status}`, response.status);
  }
  return response.blob();
};

/**
 * Fetch attachment as a Blob URL for inline preview.
 * Caller must URL.revokeObjectURL() when done.
 */
export const fetchAttachmentBlobUrl = async (attachmentId: string): Promise<string> => {
  const blob = await fetchAttachmentBlob(attachmentId);
  return URL.createObjectURL(blob);
};

// ---------------------------------------------------------------------------
// Invoice Export
// ---------------------------------------------------------------------------

const INVOICE_YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const VALID_INVOICE_EXPORT_FORMATS: readonly InvoiceExportFormat[] = ["xlsx", "pdf"];


export async function fetchInvoiceExport(
  projectId: string,
  range: InvoiceExportRange,
  format: InvoiceExportFormat,
  typeFilter?: InvoiceExportTypeFilter,
): Promise<{ blob: Blob; filename: string }> {
  // Sync input guards — throw before any fetch
  if (!projectId) throw new Error("projectId is required");
  if (!INVOICE_YEAR_MONTH_RE.test(range.from)) throw new Error("Invalid 'from' month format (expected YYYY-MM)");
  if (!INVOICE_YEAR_MONTH_RE.test(range.to)) throw new Error("Invalid 'to' month format (expected YYYY-MM)");
  if (range.from > range.to) throw new Error("'from' must be <= 'to'");
  if (!VALID_INVOICE_EXPORT_FORMATS.includes(format)) throw new Error(`Invalid format '${format}' — must be xlsx or pdf`);

  const params = new URLSearchParams({ from: range.from, to: range.to, format });
  if (typeFilter) params.set("type", typeFilter);

  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/invoices-export?${params.toString()}`;
  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text().catch(() => res.statusText); }
    throw new ApiError(`Export failed: ${res.status}`, res.status, body);
  }

  const cd = res.headers.get("Content-Disposition");
  const filename = parseFilenameFromContentDisposition(
    cd,
    `invoices-${range.from}-to-${range.to}.${format}`,
  );

  const blob = await res.blob();
  return { blob, filename };
}
