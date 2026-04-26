import { api, ApiError, getApiAccessToken } from "@/lib/api/http";
import { env } from "@/lib/config/env";
import type {
  Invoice,
  CreateInvoicePayload,
  UpdateInvoicePayload,
  InvoiceAttachment,
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
