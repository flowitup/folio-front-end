/**
 * Project Photos API wrappers — server-only.
 * Typed wrappers for project photo endpoints (list, update, delete).
 * Upload goes through a server action that forwards FormData.
 * Client components must NOT import this; go through server actions instead.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

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

export type PhotoListResult = {
  items: ProjectPhoto[];
  total: number;
  page: number;
  perPage: number;
};

export type UpdateProjectPhotoParams = {
  caption?: string | null;
  capturedAt?: string; // ISO 8601 or YYYY-MM-DD
};

// ---- Error helper ----

/**
 * Parse a non-2xx response and produce an Error carrying `.status` and `.body`.
 * Not centralized by convention — copied per boundary to keep wrappers independent.
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

// ---- Snake→camelCase mapper ----

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

// ---- Wrappers ----

/**
 * List photos for a project with optional pagination.
 */
export async function listProjectPhotos(
  projectId: string,
  params?: { page?: number; perPage?: number }
): Promise<PhotoListResult> {
  const authHeaders = await sessionAuthHeader();

  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set("page", String(params.page));
  if (params?.perPage !== undefined) qs.set("per_page", String(params.perPage));

  const queryString = qs.toString();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos${queryString ? `?${queryString}` : ""}`;

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
    throw new Error(`Network error listing photos: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list photos");
  }

  const raw = (await response.json()) as {
    items: RawPhoto[];
    total: number;
    page: number;
    per_page: number;
  };

  return {
    items: raw.items.map(mapPhoto),
    total: raw.total,
    page: raw.page,
    perPage: raw.per_page,
  };
}

/**
 * Update caption and/or captured_at on a photo.
 */
export async function updateProjectPhoto(
  projectId: string,
  photoId: string,
  params: UpdateProjectPhotoParams
): Promise<ProjectPhoto> {
  const authHeaders = await sessionAuthHeader();

  // Map camelCase params → snake_case body expected by BE
  const body: Record<string, unknown> = {};
  if (params.caption !== undefined) body.caption = params.caption;
  if (params.capturedAt !== undefined) body.captured_at = params.capturedAt;

  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos/${encodeURIComponent(photoId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating photo: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update photo");
  }
  const raw = (await response.json()) as RawPhoto;
  return mapPhoto(raw);
}

/**
 * Soft-delete a photo. Expects 204 No Content on success.
 */
export async function deleteProjectPhoto(
  projectId: string,
  photoId: string
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos/${encodeURIComponent(photoId)}`,
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
    throw new Error(`Network error deleting photo: ${String(err)}`);
  }
  if (response.status !== 204) {
    throw await buildHttpError(response, "Failed to delete photo");
  }
}
