/**
 * Tags API wrappers — project-scoped phase tags CRUD + summary.
 * Server-only — imports next/headers via sessionAuthHeader.
 * Client components must NOT import this; go through server actions instead.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

export interface ProjectTag {
  id: string;
  project_id: string;
  name: string;
  color: string; // #rrggbb
  created_at: string;
  updated_at: string | null;
}

export interface TagListResult {
  items: ProjectTag[];
  count: number;
}

export interface CreateTagPayload {
  name: string;
  color: string;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string;
}

export interface TagSummaryRow {
  tag_id: string | null;
  tag_name: string | null;
  tag_color: string | null;
  labor_cost: number;
  expense_total: number;
  labor_entry_count: number;
  invoice_count: number;
}

export interface TagSummaryResult {
  rows: TagSummaryRow[];
  count: number;
}

// ---- Error helper ----

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

export async function listTags(projectId: string): Promise<TagListResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/tags`,
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
  return response.json() as Promise<TagListResult>;
}

export async function createTag(
  projectId: string,
  payload: CreateTagPayload
): Promise<ProjectTag> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/tags`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error creating tag: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to create tag");
  }
  return response.json() as Promise<ProjectTag>;
}

export async function updateTag(
  projectId: string,
  tagId: string,
  patch: UpdateTagPayload
): Promise<ProjectTag> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/tags/${encodeURIComponent(tagId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        body: JSON.stringify(patch),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating tag: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update tag");
  }
  return response.json() as Promise<ProjectTag>;
}

export async function deleteTag(
  projectId: string,
  tagId: string
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/tags/${encodeURIComponent(tagId)}`,
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
    throw new Error(`Network error deleting tag: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to delete tag");
  }
}

export async function getTagSummary(
  projectId: string
): Promise<TagSummaryResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/tag-summary`,
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
    throw new Error(`Network error fetching tag summary: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to fetch tag summary");
  }
  return response.json() as Promise<TagSummaryResult>;
}
