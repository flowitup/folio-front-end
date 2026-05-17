"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  listProjectDocuments,
  deleteProjectDocument,
} from "@/lib/api/project-documents";
import type {
  ListProjectDocumentsParams,
  ListProjectDocumentsResult,
} from "@/lib/api/project-documents";

// ---- UUID validation ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Error classification (mirrors notes/actions.ts pattern) ----

function classifyBackendError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const status = e.status;

  if (status === 400 || status === 422) return "validation";
  if (status === 401) redirect("/login");
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "generic";
}

// ---- Action result types ----

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string };

// ---- Server actions ----

/**
 * List documents for a project with optional filtering and pagination.
 */
export async function listDocumentsAction(
  projectId: string,
  params?: ListProjectDocumentsParams
): Promise<ActionResult<ListProjectDocumentsResult>> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }

  try {
    const data = await listProjectDocuments(projectId, params);
    return { ok: true, data };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Delete a document from a project.
 * Revalidates the documents page cache on success.
 */
export async function deleteDocumentAction(
  projectId: string,
  docId: string
): Promise<ActionResult<null>> {
  if (!projectId || !isUuid(projectId)) {
    return { ok: false, error: "validation", message: "Invalid project id" };
  }
  if (!docId || !isUuid(docId)) {
    return { ok: false, error: "validation", message: "Invalid document id" };
  }

  try {
    await deleteProjectDocument(projectId, docId);
    // Route groups like `(app)` are stripped from cache keys by Next.js, so
    // including them here makes the call a silent no-op. Use the resolved path
    // template without route-group segments.
    revalidatePath(`/[locale]/projects/${projectId}/documents`, "page");
    return { ok: true, data: null };
  } catch (err: unknown) {
    return { ok: false, error: classifyBackendError(err) };
  }
}
