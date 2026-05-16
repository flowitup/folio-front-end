"use client";

/**
 * Client-side helper to fetch project documents as Blob URLs.
 *
 * The BE /download endpoint requires Authorization: Bearer <jwt>.
 * Native <embed src>, <img src>, and <a download> cannot send custom headers,
 * so this module uses fetch() with the Bearer header then URL.createObjectURL()
 * to serve the file from an authenticated request.
 */

import { getApiAccessToken, getCsrfToken } from "@/lib/api/http";
import { env } from "@/lib/config/env";

// ---- Types ----

export type DocumentBlob = {
  objectUrl: string;
  contentType: string;
  revoke: () => void;
};

// ---- Helpers ----

/**
 * Fetch a project document from the authenticated download endpoint and return
 * a short-lived object URL. Caller is responsible for calling revoke() when the
 * URL is no longer needed (e.g. on component unmount or dialog close).
 *
 * Throws "not_authenticated" if no access token is present.
 * Throws "fetch_failed:<status>:<body>" for non-2xx responses.
 */
export async function fetchProjectDocumentBlob(
  projectId: string,
  docId: string,
  signal?: AbortSignal,
): Promise<DocumentBlob> {
  const token = getApiAccessToken();
  if (!token) throw new Error("not_authenticated");

  const csrf = getCsrfToken();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/download`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      // CSRF is not required for GET, but include if present for defense-in-depth
      ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
    },
    credentials: "include",
    signal,
  });

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
