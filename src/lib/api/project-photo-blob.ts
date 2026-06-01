"use client";

/**
 * Authenticated blob fetch for project photo thumbnails and originals.
 * Uses cookie-based auth (credentials:"include") + CSRF header, mirrors
 * project-document-blob.ts with URL swapped to the photos endpoint.
 */

import { getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";

export type PhotoBlob = {
  objectUrl: string;
  contentType: string;
  revoke: () => void;
};

/**
 * Fetch a project photo as an authenticated blob, returning an object URL.
 * Handles 401 by attempting a token refresh and retrying once.
 * Caller is responsible for calling revoke() when the URL is no longer needed
 * to prevent memory leaks.
 */
export async function fetchProjectPhotoBlob(
  projectId: string,
  photoId: string,
  variant: "thumbnail" | "original",
  signal?: AbortSignal
): Promise<PhotoBlob> {
  const csrf = getCsrfToken();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos/${encodeURIComponent(photoId)}/${variant}`;

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
