"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  updateProjectPhoto,
  deleteProjectPhoto,
} from "@/lib/api/project-photos";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import { env } from "@/lib/config/env";
import type { ProjectPhoto } from "@/lib/api/project-photos";

// ---- UUID validation ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Error classification ----

/**
 * Maps HTTP error codes and BE error codes to user-facing i18n keys.
 * Mirrors the notes/documents pattern and extends with photo-specific codes.
 */
function classifyBackendError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const status = e.status;
  const code = e.body?.error;

  // Photo-specific BE error codes
  if (code === "FILE_TOO_LARGE") return "oversize";
  if (code === "UNSUPPORTED_TYPE") return "unsupported";
  if (code === "INVALID_IMAGE") return "invalidImage";

  if (status === 400 || status === 422) return "validation";
  if (status === 401) redirect("/login");
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 413) return "oversize";
  if (status === 415) return "unsupported";
  if (status === 429) return "rateLimited";
  return "server";
}

// ---- Action result types ----

export type PhotoActionResult =
  | { ok: true; data: ProjectPhoto }
  | { ok: false; error: string; message?: string };

export type DeleteActionResult =
  | { ok: true }
  | { ok: false; error: string; message?: string };

// ---- Server actions ----

/**
 * Upload a single photo by forwarding multipart FormData to the BE.
 * Keeps JWT server-side — the access_token_cookie is read via sessionAuthHeader.
 * FormData must contain: file (File), optionally caption (string), captured_at (string).
 */
export async function uploadPhotoAction(
  projectId: string,
  formData: FormData
): Promise<PhotoActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }

  const authHeaders = await sessionAuthHeader();
  if (!authHeaders.Authorization) {
    redirect("/login");
  }

  // Re-assemble a fresh FormData with only the fields the BE expects,
  // so we don't accidentally forward extra client fields.
  const beFormData = new FormData();
  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "validation", message: "No file provided" };
  }
  beFormData.append("file", file, file.name);

  const caption = formData.get("caption");
  if (caption && typeof caption === "string" && caption.trim()) {
    beFormData.append("caption", caption.trim());
  }

  const capturedAt = formData.get("captured_at");
  if (capturedAt && typeof capturedAt === "string" && capturedAt.trim()) {
    beFormData.append("captured_at", capturedAt.trim());
  }

  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/photos`,
      {
        method: "POST",
        headers: {
          // Do NOT set Content-Type — let Node/fetch set it with the boundary
          ...authHeaders,
        },
        body: beFormData,
        cache: "no-store",
      }
    );
  } catch (err) {
    return { ok: false, error: "network", message: String(err) };
  }

  if (!response.ok) {
    let body: { error?: string; message?: string } | null = null;
    try {
      body = (await response.json()) as { error?: string; message?: string };
    } catch {
      // Non-JSON body
    }
    const syntheticErr = { status: response.status, body };
    return { ok: false, error: classifyBackendError(syntheticErr) };
  }

  // Revalidate the photos page cache so subsequent SSR loads pick up the new photo
  revalidatePath(`/[locale]/projects/${projectId}/photos`, "page");

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
  const raw = (await response.json()) as RawPhoto;
  const data: ProjectPhoto = {
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

  return { ok: true, data };
}

/**
 * Update caption and/or captured_at on an existing photo.
 */
export async function updatePhotoAction(
  projectId: string,
  photoId: string,
  params: { caption?: string | null; capturedAt?: string }
): Promise<PhotoActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }
  if (!photoId || !isUuid(photoId)) {
    return { ok: false, error: "validation", message: "Invalid photo id" };
  }

  try {
    const data = await updateProjectPhoto(projectId, photoId, params);
    revalidatePath(`/[locale]/projects/${projectId}/photos`, "page");
    return { ok: true, data };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Delete a photo by ID.
 */
export async function deletePhotoAction(
  projectId: string,
  photoId: string
): Promise<DeleteActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }
  if (!photoId || !isUuid(photoId)) {
    return { ok: false, error: "validation", message: "Invalid photo id" };
  }

  try {
    await deleteProjectPhoto(projectId, photoId);
    revalidatePath(`/[locale]/projects/${projectId}/photos`, "page");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}
