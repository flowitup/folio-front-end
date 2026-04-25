import { api } from "@/lib/api/http";
import type { Invoice, CreateInvoicePayload, UpdateInvoicePayload } from "@/types/invoice";

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
