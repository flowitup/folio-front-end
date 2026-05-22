"use client";

import { getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";

// ---- Types ----

export type DocumentBlob = {
  objectUrl: string;
  contentType: string;
  revoke: () => void;
};

// ---- Helpers ----

export async function fetchProjectDocumentBlob(
  projectId: string,
  docId: string,
  signal?: AbortSignal,
): Promise<DocumentBlob> {
  const csrf = getCsrfToken();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/download`;

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
    const body = await res.text().catch(() => "");
    throw new Error(`fetch_failed:${res.status}:${body.slice(0, 200)}`);
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    contentType,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

/**
 * Trigger a browser download for a project document using an authenticated
 * fetch. Creates a transient <a> element, clicks it, then revokes the object
 * URL after a short delay so the browser has time to initiate the download.
 */
export async function downloadProjectDocument(
  projectId: string,
  docId: string,
  filename: string,
): Promise<void> {
  const b = await fetchProjectDocumentBlob(projectId, docId);
  try {
    const a = document.createElement("a");
    a.href = b.objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revocation slightly so the browser has time to start the download.
    setTimeout(() => b.revoke(), 1000);
  }
}
