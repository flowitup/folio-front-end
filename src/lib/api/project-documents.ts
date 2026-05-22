/**
 * Project Documents API wrappers
 * Typed wrappers for project documents endpoints.
 * Server-only — imports next/headers via sessionAuthHeader.
 * Client components must NOT import this; go through server actions instead.
 * Upload is intentionally omitted — uploads go direct from browser for progress streaming.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

export type ProjectDocumentKind =
  | "pdf"
  | "image"
  | "spreadsheet"
  | "doc"
  | "cad"
  | "text"
  | "other";

export type ProjectDocument = {
  id: string;
  project_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: ProjectDocumentKind;
  uploaded_at: string; // ISO 8601
  uploader_id: string;
  download_url: string; // relative API path
  tags: string[];
};

export type ListProjectDocumentsParams = {
  kinds?: ProjectDocumentKind[];
  tags?: string[];
  uploaderId?: string;
  sort?: "name" | "size" | "created_at" | "uploader";
  order?: "asc" | "desc";
  page?: number;
  perPage?: number;
};

export type ListProjectDocumentsResult = {
  items: ProjectDocument[];
  total: number;
  page: number;
  per_page: number;
};

// ---- Error helper ----

/**
 * Parse a non-2xx response and produce an Error carrying `.status` and `.body`.
 * Mirrors the same helper in notes.ts.
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
 * List documents for a project with optional filtering and pagination.
 * Maps `kinds` → repeated `type=` query params as the BE expects.
 */
export async function listProjectDocuments(
  projectId: string,
  params?: ListProjectDocumentsParams
): Promise<ListProjectDocumentsResult> {
  const authHeaders = await sessionAuthHeader();

  const qs = new URLSearchParams();
  if (params?.kinds && params.kinds.length > 0) {
    for (const kind of params.kinds) {
      qs.append("type", kind);
    }
  }
  if (params?.tags && params.tags.length > 0) {
    for (const tag of params.tags) {
      qs.append("tag", tag);
    }
  }
  if (params?.uploaderId) qs.set("uploader_id", params.uploaderId);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.order) qs.set("order", params.order);
  if (params?.page !== undefined) qs.set("page", String(params.page));
  if (params?.perPage !== undefined) qs.set("per_page", String(params.perPage));

  const queryString = qs.toString();
  const url = `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents${queryString ? `?${queryString}` : ""}`;

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
    throw new Error(`Network error listing documents: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list documents");
  }
  return response.json() as Promise<ListProjectDocumentsResult>;
}

/**
 * Rename a document by ID.
 * Returns the updated document on success.
 */
export async function renameProjectDocument(
  projectId: string,
  docId: string,
  filename: string
): Promise<ProjectDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/rename`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify({ filename }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error renaming document: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to rename document");
  }
  return response.json() as Promise<ProjectDocument>;
}

/**
 * Delete a document by ID.
 * Expects 204 No Content on success.
 */
export async function deleteProjectDocument(
  projectId: string,
  docId: string
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}`,
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
    throw new Error(`Network error deleting document: ${String(err)}`);
  }
  if (response.status !== 204) {
    throw await buildHttpError(response, "Failed to delete document");
  }
}

/**
 * Replace all tags on a document.
 * Returns the updated document on success.
 */
export async function updateDocumentTags(
  projectId: string,
  docId: string,
  tags: string[]
): Promise<ProjectDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/tags`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify({ tags }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating tags: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update tags");
  }
  return response.json() as Promise<ProjectDocument>;
}

/**
 * List all distinct tags used by documents in a project.
 */
export async function listDocumentTags(
  projectId: string
): Promise<string[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/documents/tags`,
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
    throw new Error(`Network error listing tags: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list tags");
  }
  const data = (await response.json()) as { tags: string[] };
  return data.tags;
}

/**
 * Return the BE-relative download URL for a document.
 * The FE proxies this via Next.js same-origin rewrite in dev/docker-compose.
 */
export function getProjectDocumentDownloadUrl(
  projectId: string,
  docId: string
): string {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/download`;
}
