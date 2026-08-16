"use client";

/**
 * Client-side authenticated fetch for an analysis report's raw HTML body,
 * returning a `blob:` object URL. Mirrors src/lib/api/project-document-blob.ts
 * (cookie session + CSRF header, 401 → refresh-and-retry once).
 *
 * The returned blob is deliberately re-tagged as `text/html` regardless of
 * what the response declared, since the sandboxed iframe in
 * analysis-viewer.tsx relies on the object URL resolving as an HTML document.
 */

import { getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";

// ---- Types ----

export type AnalysisBlob = {
  objectUrl: string;
  revoke: () => void;
};

// ---- Error helper ----

function fetchError(status: number): Error & { status: number } {
  const err = new Error(`Failed to fetch analysis content (HTTP ${status})`) as Error & {
    status: number;
  };
  err.status = status;
  return err;
}

// ---- Helper ----

/**
 * Fetch the HTML body of an analysis report and return a revocable blob URL.
 * Callers MUST call `revoke()` when the blob is no longer needed (component
 * unmount, analysis change) to avoid leaking object URLs across navigations.
 */
export async function fetchProjectAnalysisBlob(
  projectId: string,
  analysisId: string,
  signal?: AbortSignal
): Promise<AnalysisBlob> {
  const csrf = getCsrfToken();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(analysisId)}/content`;

  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRF-TOKEN"] = csrf;

  let res = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
    signal,
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessTokenViaCookie();
    if (refreshed) {
      res = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
        signal,
      });
    }
  }

  if (!res.ok) {
    throw fetchError(res.status);
  }

  const rawBlob = await res.blob();
  const htmlBlob = new Blob([rawBlob], { type: "text/html" });
  const objectUrl = URL.createObjectURL(htmlBlob);

  return {
    objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}
