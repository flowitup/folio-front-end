"use server";

import { redirect } from "next/navigation";
import {
  createNote,
  updateNote,
  deleteNote,
} from "@/lib/api/notes";
import { getSession } from "@/lib/auth/session";
import type { Note, CreateNotePayload, UpdateNotePayload } from "@/lib/api/notes";

// ---- UUID validation ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Error classification (mirrors admin/users pattern) ----

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

export type NoteActionResult =
  | { success: true; note: Note }
  | { success: false; error: string };

export type DeleteActionResult =
  | { success: true }
  | { success: false; error: string };

// ---- Server actions ----

/**
 * Create a new note for a project.
 */
export async function createNoteAction(
  projectId: string,
  payload: CreateNotePayload
): Promise<NoteActionResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { success: false, error: "unauthorized" };
  }
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!payload.title || payload.title.trim().length === 0) {
    return { success: false, error: "validation" };
  }
  if (!payload.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)) {
    return { success: false, error: "validation" };
  }

  try {
    const note = await createNote(projectId, {
      ...payload,
      title: payload.title.trim(),
    });
    return { success: true, note };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

/**
 * Update (patch) an existing note.
 */
export async function updateNoteAction(
  projectId: string,
  noteId: string,
  patch: UpdateNotePayload
): Promise<NoteActionResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { success: false, error: "unauthorized" };
  }
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!noteId || !isUuid(noteId)) {
    return { success: false, error: "validation" };
  }
  if (patch.due_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.due_date)) {
    return { success: false, error: "validation" };
  }

  const sanitized: UpdateNotePayload = { ...patch };
  if (sanitized.title !== undefined) {
    sanitized.title = sanitized.title.trim();
    if (sanitized.title.length === 0) {
      return { success: false, error: "validation" };
    }
  }

  try {
    const note = await updateNote(projectId, noteId, sanitized);
    return { success: true, note };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

/**
 * Delete a note.
 */
export async function deleteNoteAction(
  projectId: string,
  noteId: string
): Promise<DeleteActionResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { success: false, error: "unauthorized" };
  }
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!noteId || !isUuid(noteId)) {
    return { success: false, error: "validation" };
  }

  try {
    await deleteNote(projectId, noteId);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

/**
 * Mark a note as done.
 */
export async function markNoteDoneAction(
  projectId: string,
  noteId: string
): Promise<NoteActionResult> {
  return updateNoteAction(projectId, noteId, { status: "done" });
}

/**
 * Mark a note as open (reopen).
 */
export async function markNoteOpenAction(
  projectId: string,
  noteId: string
): Promise<NoteActionResult> {
  return updateNoteAction(projectId, noteId, { status: "open" });
}
