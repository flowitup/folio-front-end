/**
 * Client-side API wrapper for the quotes and invoices linked to one project.
 * Uses the browser `api` client (cookie auth, refresh on 401) — safe to import
 * from client components.
 */

import { api } from "@/lib/api/http";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

/**
 * GET /projects/<project_id>/billing-documents
 *
 * Returns every billing document linked to the project (any kind, status or
 * issuer), newest issue date first, as the backend orders them.
 */
export async function fetchProjectBillingDocuments(
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectBillingDocumentSummary[]> {
  const data = await api.get<{ billing_documents: ProjectBillingDocumentSummary[] }>(
    `/projects/${encodeURIComponent(projectId)}/billing-documents`,
    { signal }
  );
  return data.billing_documents ?? [];
}
