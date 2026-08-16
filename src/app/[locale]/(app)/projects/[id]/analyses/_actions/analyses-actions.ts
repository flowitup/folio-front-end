"use server";

/**
 * Project analyses server actions.
 *
 * Thin wrappers around src/lib/api/project-analyses.ts: validate ids,
 * forward to the server-only typed wrappers, classify backend errors into
 * i18n-friendly codes, and revalidate the analyses pages on success.
 *
 * Auth model: analyses use JWT bearer auth via sessionAuthHeader() (the
 * server-only wrapper reads the existing session cookie and forwards it as
 * an Authorization header) — the backend never issues new cookies on these
 * routes, so there is nothing to forward via Set-Cookie here. The
 * setForwardedCookies pattern (see src/lib/auth/actions.ts) only applies to
 * login/refresh flows that mint new session cookies; billing-actions.ts
 * documents this same distinction.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  listProjectAnalyses,
  createProjectAnalysis,
  updateProjectAnalysis,
  deleteProjectAnalysis,
} from "@/lib/api/project-analyses";
import type {
  ProjectAnalysis,
  ProjectAnalysisPage,
  ListAnalysesParams,
  UpdateAnalysisPayload,
} from "@/lib/api/project-analyses";

// ---- UUID validation ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Error classification (mirrors notes/documents/photos actions.ts pattern) ----

/**
 * Maps HTTP status codes to i18n-friendly error keys. 413 is surfaced
 * distinctly from 400 so upload UI can say "file too large" rather than
 * "invalid file" (400 covers non-HTML/undecodable content).
 */
function classifyBackendError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const status = e.status;

  if (status === 413) return "tooLarge";
  if (status === 400) return "invalidFile";
  if (status === 422) return "validation";
  if (status === 401) redirect("/login");
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "generic";
}

// ---- Action result types ----

export type AnalysisActionResult =
  | { ok: true; data: ProjectAnalysis }
  | { ok: false; error: string };

export type ListAnalysesActionResult =
  | { ok: true; data: ProjectAnalysisPage }
  | { ok: false; error: string };

export type DeleteAnalysisActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ---- Server actions ----

/**
 * List analyses for a project with optional search/tag filter/pagination.
 * Used by the panel's client-side refresh effect (search debounce, tag
 * toggle, pagination) — the phase-05 spec's export list didn't call this out
 * explicitly, but it is required for analyses-panel.tsx to refetch without a
 * full page navigation, matching the documents/photos precedent
 * (listDocumentsAction / loadMorePhotosAction).
 */
export async function listAnalysesAction(
  projectId: string,
  params?: ListAnalysesParams
): Promise<ListAnalysesActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation" };
  }

  try {
    const data = await listProjectAnalyses(projectId, params);
    return { ok: true, data };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Upload a new analysis report. `formData` is passed straight through from
 * the client — do NOT read the file into memory here, that would double the
 * footprint and defeat the 2 MB cap semantics enforced server-side.
 */
export async function uploadAnalysisAction(
  projectId: string,
  formData: FormData
): Promise<AnalysisActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "invalidFile" };
  }
  const title = formData.get("title");
  if (typeof title !== "string" || !title.trim()) {
    return { ok: false, error: "validation" };
  }

  try {
    const data = await createProjectAnalysis(projectId, formData);
    revalidatePath(`/[locale]/projects/${projectId}/analyses`, "page");
    return { ok: true, data };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Update an analysis report's metadata. `patch` must only include keys the
 * user actually changed — the backend leaves omitted fields untouched.
 */
export async function updateAnalysisAction(
  projectId: string,
  analysisId: string,
  patch: UpdateAnalysisPayload
): Promise<AnalysisActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation" };
  }
  if (!analysisId || !isUuid(analysisId)) {
    return { ok: false, error: "validation" };
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "validation" };
  }

  try {
    const data = await updateProjectAnalysis(projectId, analysisId, patch);
    revalidatePath(`/[locale]/projects/${projectId}/analyses`, "page");
    revalidatePath(`/[locale]/projects/${projectId}/analyses/${analysisId}`, "page");
    return { ok: true, data };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Delete (soft-delete) an analysis report.
 */
export async function deleteAnalysisAction(
  projectId: string,
  analysisId: string
): Promise<DeleteAnalysisActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation" };
  }
  if (!analysisId || !isUuid(analysisId)) {
    return { ok: false, error: "validation" };
  }

  try {
    await deleteProjectAnalysis(projectId, analysisId);
    revalidatePath(`/[locale]/projects/${projectId}/analyses`, "page");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}
