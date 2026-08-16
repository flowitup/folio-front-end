/**
 * Project Analyses API wrappers
 * Typed wrappers for project analyses endpoints (LearnFlow-style report library).
 * Server-only — imports next/headers via sessionAuthHeader.
 * Client components must NOT import this; go through server actions instead.
 *
 * Note on tags: the tag filter options come from
 * `GET /projects/<id>/analyses/tags` (the project's whole tag vocabulary), not
 * from the tags present in the currently loaded page — otherwise a tag that
 * only appears on page 2 would be missing from the filter.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

export interface ProjectAnalysis {
  id: string;
  project_id: string;
  uploader_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  size_bytes: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  /** Relative backend path — the viewer loads the report through the
   * same-origin proxy at /analysis-report/<projectId>/<analysisId> instead. */
  content_url: string;
}

export interface ProjectAnalysisPage {
  items: ProjectAnalysis[];
  total: number;
  page: number;
  per_page: number;
}

export type ListAnalysesParams = {
  q?: string;
  tags?: string[];
  sort?: "created_at" | "title";
  order?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type UpdateAnalysisPayload = {
  title?: string;
  summary?: string | null;
  source_url?: string | null;
  tags?: string[];
};

// ---- Error helper ----

/**
 * Parse a non-2xx response and produce an Error carrying `.status` and `.body`.
 * Copied from src/lib/api/notes.ts — not centralized by convention (each API
 * boundary keeps its own copy so wrappers stay independent).
 */
async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

// ---- Wrappers ----

/**
 * List analysis reports for a project. Search + tag filter + pagination.
 * `tags` maps to repeated `?tag=` query params (BE expects AND semantics).
 */
export async function listProjectAnalyses(
  projectId: string,
  params?: ListAnalysesParams
): Promise<ProjectAnalysisPage> {
  const authHeaders = await sessionAuthHeader();

  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.tags && params.tags.length > 0) {
    for (const tag of params.tags) qs.append("tag", tag);
  }
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.order) qs.set("order", params.order);
  if (params?.page !== undefined) qs.set("page", String(params.page));
  if (params?.perPage !== undefined) qs.set("per_page", String(params.perPage));

  const queryString = qs.toString();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses${queryString ? `?${queryString}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing analyses: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list analyses");
  }
  return response.json() as Promise<ProjectAnalysisPage>;
}

/**
 * List every distinct tag used by a project's analyses, for the filter UI.
 */
export async function listProjectAnalysisTags(projectId: string): Promise<string[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/tags`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing analysis tags: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list analysis tags");
  }
  const body = (await response.json()) as { tags: string[] };
  return body.tags;
}

/**
 * Get a single analysis report's metadata.
 */
export async function getProjectAnalysis(
  projectId: string,
  analysisId: string
): Promise<ProjectAnalysis> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching analysis: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to fetch analysis");
  }
  return response.json() as Promise<ProjectAnalysis>;
}

/**
 * Upload a new analysis report. `formData` is forwarded to the backend as-is
 * (multipart/form-data) — callers must NOT re-read the file into memory
 * before calling this; that would double the in-memory footprint and defeat
 * the 2 MB cap semantics enforced server-side.
 * Expects fields: file, title, summary?, source_url?, tags? (repeatable).
 */
export async function createProjectAnalysis(
  projectId: string,
  formData: FormData
): Promise<ProjectAnalysis> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses`,
      {
        method: "POST",
        // No Content-Type here — fetch sets the multipart boundary itself
        // when the body is a FormData instance. Setting it manually strips
        // the boundary and breaks parsing server-side.
        headers: { ...authHeaders },
        body: formData,
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error creating analysis: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to create analysis");
  }
  return response.json() as Promise<ProjectAnalysis>;
}

/**
 * Update an analysis report's title/summary/source_url/tags. Only include
 * keys the caller actually wants to change — `JSON.stringify` drops
 * `undefined` properties, and the backend leaves any field absent from the
 * raw JSON payload untouched (PATCH semantics, not PUT).
 */
export async function updateProjectAnalysis(
  projectId: string,
  analysisId: string,
  patch: UpdateAnalysisPayload
): Promise<ProjectAnalysis> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify(patch),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating analysis: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update analysis");
  }
  return response.json() as Promise<ProjectAnalysis>;
}

/**
 * Soft-delete an analysis report. Expects 204 No Content on success.
 */
export async function deleteProjectAnalysis(
  projectId: string,
  analysisId: string
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error deleting analysis: ${String(err)}`);
  }
  if (response.status !== 204) {
    throw await buildHttpError(response, "Failed to delete analysis");
  }
}
