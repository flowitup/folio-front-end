"use client";

/**
 * Client-side helpers for project photo blobs and uploads.
 * Uses cookie-based auth (credentials:"include") + CSRF header — bytes never
 * pass through the Next.js server, so the 1 MB server-action body cap is avoided.
 */

import { getCsrfToken } from "@/lib/api/http";
import { refreshAccessTokenViaCookie } from "@/lib/api/refresh";
import { env } from "@/lib/config/env";
import { withInferredContentType } from "@/lib/media/infer-content-type";

// ---- Types ----

/**
 * Camel-cased photo record returned by the BE after a successful upload or GET.
 * Mirrors project-photos.ts ProjectPhoto but defined here so client code never
 * imports the server-only project-photos module.
 */
export type ProjectPhoto = {
  id: string;
  projectId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  caption: string | null;
  capturedAt: string; // ISO 8601
  uploadedAt: string; // ISO 8601
  uploaderId: string;
  thumbnailUrl: string; // relative API path
  originalUrl: string; // relative API path
};

// Raw snake_case shape returned by the BE
type RawPhoto = {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  caption: string | null;
  captured_at: string;
  uploaded_at: string;
  uploader_id: string;
  thumbnail_url: string;
  original_url: string;
};

function mapPhoto(raw: RawPhoto): ProjectPhoto {
  return {
    id: raw.id,
    projectId: raw.project_id,
    filename: raw.filename,
    contentType: raw.content_type,
    sizeBytes: raw.size_bytes,
    caption: raw.caption,
    capturedAt: raw.captured_at,
    uploadedAt: raw.uploaded_at,
    uploaderId: raw.uploader_id,
    thumbnailUrl: raw.thumbnail_url,
    originalUrl: raw.original_url,
  };
}

export type PhotoBlob = {
  objectUrl: string;
  contentType: string;
  revoke: () => void;
};

// ---- Upload ----

/**
 * Upload a single photo directly from the browser to the BE.
 * Keeps bytes out of the Next.js server (avoids the 1 MB body cap on server
 * actions). Uses cookie-based auth + CSRF, retrying once on 401.
 *
 * On non-2xx the thrown Error carries `.status` (number) and
 * `.body` ({error?:string, message?:string}|null) so the caller can classify
 * the error without knowing HTTP internals.
 */
export async function uploadProjectPhoto(
  projectId: string,
  file: File,
  opts: { caption?: string; capturedAt?: string }
): Promise<ProjectPhoto> {
  const csrf = getCsrfToken();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos`;

  const headers: Record<string, string> = {};
  if (csrf) headers["X-CSRF-TOKEN"] = csrf;

  // Re-tag files whose browser MIME is empty/generic (e.g. messaging-app
  // videos) so the multipart part carries a concrete type — otherwise the BE
  // 415s and/or stores a non-video content_type.
  const uploadFile = withInferredContentType(file);

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.append("file", uploadFile, uploadFile.name);
    if (opts.caption && opts.caption.trim()) {
      fd.append("caption", opts.caption.trim());
    }
    if (opts.capturedAt && opts.capturedAt.trim()) {
      // BE expects snake_case form field name
      fd.append("captured_at", opts.capturedAt.trim());
    }
    return fd;
  }

  // Do NOT set Content-Type — browser sets multipart/form-data with boundary.
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: buildFormData(),
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessTokenViaCookie();
    if (refreshed) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: buildFormData(),
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    let body: { error?: string; message?: string } | null = null;
    try {
      body = (await res.json()) as { error?: string; message?: string };
    } catch {
      // Non-JSON body — leave null.
    }
    const err = new Error(`upload_failed:${res.status}`) as Error & {
      status: number;
      body: { error?: string; message?: string } | null;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const raw = (await res.json()) as RawPhoto;
  return mapPhoto(raw);
}

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
