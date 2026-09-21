/**
 * Assistant audit API wrapper — server-only.
 *
 * GET /api/v1/assistant/audit?company_id=&from=&to=&user_id=&limit= — company admins only
 * (403 otherwise); the backend enforces the admin gate independently, this page's own
 * guard (`isCompanyAdmin`) is defense-in-depth so a non-admin never fires the request.
 *
 * Same shape as the other server-only wrappers under `src/lib/api/*.ts`
 * (`sessionAuthHeader()` + manual fetch + a local `buildHttpError`, not centralized —
 * see `notes.ts`).
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { AssistantAuditListResult, ListAssistantAuditParams } from "@/types/assistant-audit";

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: Record<string, unknown> | null }> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: Record<string, unknown> | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

/**
 * List the assistant's handled mentions for one company over a date range, newest first.
 */
export async function listAssistantAudit(
  params: ListAssistantAuditParams
): Promise<AssistantAuditListResult> {
  const authHeaders = await sessionAuthHeader();
  const query = new URLSearchParams({
    company_id: params.companyId,
    from: params.from,
    to: params.to,
  });
  if (params.userId) query.set("user_id", params.userId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/assistant/audit?${query.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing assistant audit: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list assistant audit");
  return response.json() as Promise<AssistantAuditListResult>;
}
