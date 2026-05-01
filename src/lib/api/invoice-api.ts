import { api, ApiError, getApiAccessToken } from "@/lib/api/http";
import { env } from "@/lib/config/env";
import type {
  Invoice,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  InvoiceAttachment,
  InvoiceExportFormat,
  InvoiceExportRange,
  InvoiceExportTypeFilter,
} from "@/types/invoice";

export const fetchInvoices = (projectId: string, type?: string): Promise<Invoice[]> =>
  api
    .get<{ invoices: Invoice[]; total: number }>(
      `/projects/${projectId}/invoices${type ? `?type=${type}` : ""}`
    )
    .then((r) => r.invoices);

export const fetchInvoice = (projectId: string, invoiceId: string): Promise<Invoice> =>
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

  const token = getApiAccessToken();
  const response = await fetch(
    `${env.apiBaseUrl}/projects/${projectId}/invoices/${invoiceId}/attachments`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
 * Fetch attachment as a Blob URL for inline preview.
 * Use for <img src> on protected endpoints since browsers won't send auth headers automatically.
 * Caller must URL.revokeObjectURL() when done.
 */
export const fetchAttachmentBlobUrl = async (attachmentId: string): Promise<string> => {
  const token = getApiAccessToken();
  const response = await fetch(`${env.apiBaseUrl}/attachments/${attachmentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(`Download failed: ${response.status}`, response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// ---------------------------------------------------------------------------
// Invoice Export
// ---------------------------------------------------------------------------

const INVOICE_YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const VALID_INVOICE_EXPORT_FORMATS: readonly InvoiceExportFormat[] = ["xlsx", "pdf"];

/**
 * Parse filename from Content-Disposition header.
 * Supports RFC 5987 extended form (filename*=UTF-8''...) and quoted form (filename="...").
 * Mirrors the parser in labor.ts — inlined here to avoid cross-file coupling.
 */
function parseInvoiceFilenameFromContentDisposition(cd: string): string | null {
  // RFC 5987 extended form: filename*=UTF-8''...
  const extMatch = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (extMatch) {
    try { return decodeURIComponent(extMatch[1].trim()); } catch { return extMatch[1].trim(); }
  }
  // Quoted form: filename="..."
  const quotedMatch = cd.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1].trim();
  // Bare form: filename=...
  const bareMatch = cd.match(/filename=([^;]+)/i);
  if (bareMatch) return bareMatch[1].trim();
  return null;
}

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

  const url = `${env.apiBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/invoices-export?${params.toString()}`;
  const token = getApiAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text().catch(() => res.statusText); }
    throw new ApiError(`Export failed: ${res.status}`, res.status, body);
  }

  const cd = res.headers.get("Content-Disposition") ?? "";
  const filename =
    parseInvoiceFilenameFromContentDisposition(cd) ??
    `invoices-${range.from}-to-${range.to}.${format}`;

  const blob = await res.blob();
  return { blob, filename };
}
