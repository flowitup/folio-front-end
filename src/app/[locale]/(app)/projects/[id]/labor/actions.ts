"use server";

import { redirect } from "next/navigation";
import {
  fetchLaborRoles,
  createLaborRole,
} from "@/lib/api/labor-roles";
import { fetchDayRoster } from "@/lib/api/roster";
import type { RosterResponse } from "@/lib/api/roster";
import type {
  LaborRole,
  LaborRoleListResponse,
  CreateLaborRolePayload,
} from "@/types/labor-role";

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

export type RoleActionResult =
  | { success: true; role: LaborRole }
  | { success: false; error: string };

export type RoleListActionResult =
  | { success: true; data: LaborRoleListResponse }
  | { success: false; error: string };

// ---- Actions ----

/**
 * Fetch all labor roles and the default color palette.
 */
export async function fetchLaborRolesAction(): Promise<RoleListActionResult> {
  try {
    const data = await fetchLaborRoles();
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

/**
 * Create a new labor role.
 */
export async function createLaborRoleAction(
  payload: CreateLaborRolePayload,
): Promise<RoleActionResult> {
  if (!payload.name || payload.name.trim().length === 0) {
    return { success: false, error: "validation" };
  }
  if (!payload.color || payload.color.trim().length === 0) {
    return { success: false, error: "validation" };
  }

  try {
    const role = await createLaborRole({
      name: payload.name.trim(),
      color: payload.color.trim(),
    });
    return { success: true, role };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

// ---- Day roster (member-safe: name, presence, hours, day type — never pay) ----

export type RosterActionResult =
  | { success: true; data: RosterResponse }
  | { success: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fetch the day roster for a project. `date` must be YYYY-MM-DD. */
export async function fetchDayRosterAction(
  projectId: string,
  date: string
): Promise<RosterActionResult> {
  if (!DATE_RE.test(date)) return { success: false, error: "validation" };
  try {
    const data = await fetchDayRoster(projectId, date);
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}
