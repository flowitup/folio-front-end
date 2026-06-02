/**
 * Notes API wrappers
 * Typed wrappers for project notes endpoints.
 * Server-only — imports next/headers via sessionAuthHeader.
 * Client components must NOT import this; go through server actions instead.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

export type NoteCategory =
  | "inspection"
  | "delivery"
  | "payment"
  | "decision"
  | "call"
  | "general";

export interface Note {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string | null;
  category: NoteCategory;
  status: "open" | "done";
  created_at: string;
  updated_at: string;
}

export interface NoteListResult {
  items: Note[];
  count: number;
}

export interface CreateNotePayload {
  title: string;
  description?: string | null;
  category?: NoteCategory;
}

export interface UpdateNotePayload {
  title?: string;
  description?: string | null;
  category?: NoteCategory;
  status?: "open" | "done";
}

// ---- Error helper ----

/**
 * Parse a non-2xx response and produce an Error carrying `.status` and `.body`.
 * Mirrors the same helper in admin.ts.
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
 * List all notes for a project.
 */
export async function listProjectNotes(projectId: string): Promise<NoteListResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/notes`,
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
    throw new Error(`Network error listing notes: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list notes");
  }
  return response.json() as Promise<NoteListResult>;
}

/**
 * Create a new note in a project.
 */
export async function createNote(
  projectId: string,
  payload: CreateNotePayload
): Promise<Note> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/notes`,
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
    throw new Error(`Network error creating note: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to create note");
  }
  return response.json() as Promise<Note>;
}

/**
 * Update (patch) an existing note.
 */
export async function updateNote(
  projectId: string,
  noteId: string,
  patch: UpdateNotePayload
): Promise<Note> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
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
    throw new Error(`Network error updating note: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update note");
  }
  return response.json() as Promise<Note>;
}

/**
 * Delete a note.
 */
export async function deleteNote(projectId: string, noteId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/notes/${encodeURIComponent(noteId)}`,
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
    throw new Error(`Network error deleting note: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to delete note");
  }
}

// dismissNotification removed — canonical implementation lives in lib/api/notifications.ts
