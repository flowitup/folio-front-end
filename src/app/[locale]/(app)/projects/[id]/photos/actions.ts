"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  listProjectPhotos,
  updateProjectPhoto,
  deleteProjectPhoto,
} from "@/lib/api/project-photos";
import type { ProjectPhoto, PhotoListResult } from "@/lib/api/project-photos";

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

// ---- Load more (pagination) ----

export type LoadMorePhotosResult =
  | { ok: true; data: PhotoListResult }
  | { ok: false; error: string; message?: string };

/**
 * Load a page of photos for the gallery "Load more" button.
 * Uses the server-only listProjectPhotos wrapper; perPage is fixed at 50 to
 * match the initial page fetch in page.tsx.
 */
export async function loadMorePhotosAction(
  projectId: string,
  page: number
): Promise<LoadMorePhotosResult> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }
  if (!Number.isInteger(page) || page < 2) {
    return { ok: false, error: "validation", message: "Invalid page number" };
  }

  try {
    const data = await listProjectPhotos(projectId, { page, perPage: 50 });
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
