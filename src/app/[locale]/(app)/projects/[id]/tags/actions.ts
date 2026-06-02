"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTag, updateTag, deleteTag } from "@/lib/api/tags";
import type { ProjectTag } from "@/lib/api/tags";

// ---- UUID validation ----

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Hex color validation ----

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

// ---- Error classification ----

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
  if (status === 409) return "duplicate";
  if (status === 429) return "rateLimited";
  return "generic";
}

// ---- Result types ----

export type TagActionResult =
  | { success: true; tag: ProjectTag }
  | { success: false; error: string };

export type DeleteTagActionResult =
  | { success: true }
  | { success: false; error: string };

// ---- Server actions ----

export async function createTagAction(
  projectId: string,
  name: string,
  color: string
): Promise<TagActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!name || name.trim().length === 0) {
    return { success: false, error: "validation" };
  }
  if (!isHexColor(color)) {
    return { success: false, error: "validation" };
  }

  try {
    const tag = await createTag(projectId, {
      name: name.trim(),
      color,
    });
    revalidatePath(`/projects/${projectId}/tags`);
    return { success: true, tag };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

export async function updateTagAction(
  projectId: string,
  tagId: string,
  name: string,
  color: string
): Promise<TagActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!tagId || !isUuid(tagId)) {
    return { success: false, error: "validation" };
  }
  if (!name || name.trim().length === 0) {
    return { success: false, error: "validation" };
  }
  if (!isHexColor(color)) {
    return { success: false, error: "validation" };
  }

  try {
    const tag = await updateTag(projectId, tagId, {
      name: name.trim(),
      color,
    });
    revalidatePath(`/projects/${projectId}/tags`);
    return { success: true, tag };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

export async function deleteTagAction(
  projectId: string,
  tagId: string
): Promise<DeleteTagActionResult> {
  if (!projectId || !isUuid(projectId)) {
    return { success: false, error: "validation" };
  }
  if (!tagId || !isUuid(tagId)) {
    return { success: false, error: "validation" };
  }

  try {
    await deleteTag(projectId, tagId);
    revalidatePath(`/projects/${projectId}/tags`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}
