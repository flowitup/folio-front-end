"use server";

/**
 * Labor-role server actions, shared by the role picker on the labor page and
 * the Labor roles card under Settings › Company. Roles are company-level, not
 * project-level, so these live beside the shared labor components rather than
 * in one route's folder.
 */

import { redirect } from "next/navigation";
import {
  fetchLaborRoles,
  createLaborRole,
  updateLaborRole,
  deleteLaborRole,
} from "@/lib/api/labor-roles";
import type {
  LaborRole,
  LaborRoleListResponse,
  CreateLaborRolePayload,
  UpdateLaborRolePayload,
} from "@/types/labor-role";

// ---- Error classification ----

function classifyBackendError(err: unknown): string {
  const status = (err as { status?: number }).status;

  if (status === 400 || status === 422) return "validation";
  if (status === 401) redirect("/login");
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "duplicate";
  if (status === 429) return "rateLimited";
  return "generic";
}

/** The backend's own explanation (`{ message }`), when it sent one. */
function backendMessage(err: unknown): string | undefined {
  const message = (err as { body?: { message?: unknown } | null }).body?.message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function failure(err: unknown): RoleActionFailure {
  return { success: false, error: classifyBackendError(err), message: backendMessage(err) };
}

// ---- Result types ----

/**
 * `error` is a stable code (validation / forbidden / notFound / duplicate /
 * rateLimited / generic) the UI translates; `message` carries the backend's
 * own wording for the cases no code describes precisely.
 */
export type RoleActionFailure = { success: false; error: string; message?: string };

export type RoleActionResult = { success: true; role: LaborRole } | RoleActionFailure;

export type RoleDeleteActionResult = { success: true } | RoleActionFailure;

export type RoleListActionResult =
  | { success: true; data: LaborRoleListResponse }
  | RoleActionFailure;

// ---- Actions ----

/**
 * Fetch all labor roles and the default color palette. Without `companyId`
 * the backend answers for the caller's primary company.
 */
export async function fetchLaborRolesAction(
  companyId?: string,
): Promise<RoleListActionResult> {
  try {
    const data = await fetchLaborRoles(companyId);
    return { success: true, data };
  } catch (err: unknown) {
    return failure(err);
  }
}

/**
 * Create a new labor role, in `companyId` when given, else in the caller's
 * primary company.
 */
export async function createLaborRoleAction(
  payload: CreateLaborRolePayload,
  companyId?: string,
): Promise<RoleActionResult> {
  if (!payload.name || payload.name.trim().length === 0) {
    return { success: false, error: "validation" };
  }
  if (!payload.color || payload.color.trim().length === 0) {
    return { success: false, error: "validation" };
  }

  try {
    const role = await createLaborRole(
      {
        name: payload.name.trim(),
        color: payload.color.trim(),
      },
      companyId,
    );
    return { success: true, role };
  } catch (err: unknown) {
    return failure(err);
  }
}

/**
 * Rename and/or recolor a labor role. Only the fields present are sent, so a
 * color-only change never rewrites the name.
 */
export async function updateLaborRoleAction(
  roleId: string,
  payload: UpdateLaborRolePayload,
): Promise<RoleActionResult> {
  if (!roleId) return { success: false, error: "validation" };
  const body: UpdateLaborRolePayload = {};
  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) return { success: false, error: "validation" };
    body.name = name;
  }
  if (payload.color !== undefined) {
    const color = payload.color.trim();
    if (!color) return { success: false, error: "validation" };
    body.color = color;
  }
  if (body.name === undefined && body.color === undefined) {
    return { success: false, error: "validation" };
  }

  try {
    const role = await updateLaborRole(roleId, body);
    return { success: true, role };
  } catch (err: unknown) {
    return failure(err);
  }
}

/**
 * Delete a labor role. Workers who held it simply lose their role.
 */
export async function deleteLaborRoleAction(
  roleId: string,
): Promise<RoleDeleteActionResult> {
  if (!roleId) return { success: false, error: "validation" };
  try {
    await deleteLaborRole(roleId);
    return { success: true };
  } catch (err: unknown) {
    return failure(err);
  }
}
