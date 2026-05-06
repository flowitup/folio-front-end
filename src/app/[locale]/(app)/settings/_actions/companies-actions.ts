"use server";

/**
 * Companies server actions.
 *
 * Each action wraps a server-only API client call and returns a discriminated
 * union: { ok: true, data } | { ok: false, error: { code, message } }.
 *
 * Special-case error codes surfaced to callers:
 * - 'token_invalid'               — expired / already-redeemed / wrong token (uniform 410)
 * - 'company_already_attached'    — user already belongs to this company (409)
 * - 'forbidden_admin_required'    — admin-only endpoint called by non-admin (403)
 * - 'active_token_exists'         — POST invite-tokens without regenerate=true (409)
 *
 * IMPORTANT: generateInviteTokenAction returns { ok: true, data } where
 * data.token is the plaintext invite token, exposed exactly once.
 * The caller MUST display it immediately and MUST NOT log or store it.
 */

import {
  fetchMyCompanies,
  fetchAllCompanies,
  fetchCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  setPrimaryCompany,
  detachCompany,
} from "@/lib/api/companies/companies";
import {
  generateInviteToken,
  revokeInviteToken,
  redeemInviteToken,
} from "@/lib/api/companies/invite-tokens";
import {
  fetchAttachedUsers,
  bootAttachedUser,
} from "@/lib/api/companies/attached-users";
import type { Company, MyCompany, CompanyInviteTokenGenerated, AttachedUser } from "@/types/companies";
import type { CreateCompanyPayload, UpdateCompanyPayload } from "@/lib/api/companies/companies";

// ---------------------------------------------------------------------------
// Shared result type (re-exported so callers can type-narrow)
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Internal error classifier
// ---------------------------------------------------------------------------

function classifyBackendError(err: unknown): { code: string; message: string } {
  const e = err as {
    status?: number;
    body?: Record<string, unknown> | null;
    message?: string;
  };
  const status = e.status;
  const body = e.body ?? {};
  const reason = typeof body["reason"] === "string" ? body["reason"] : "";
  const bodyMsg = typeof body["message"] === "string" ? body["message"] : "";

  // 403 — admin-only endpoint
  if (status === 403) {
    return { code: "forbidden_admin_required", message: "Admin access is required." };
  }

  // 409 conflicts — discriminate by reason
  if (status === 409) {
    if (reason === "company_already_attached") {
      return { code: "company_already_attached", message: "You are already attached to this company." };
    }
    if (reason === "active_token_exists") {
      return {
        code: "active_token_exists",
        message: "An active invite token already exists. Use regenerate=true to replace it.",
      };
    }
    return { code: "conflict", message: bodyMsg || "A conflict occurred." };
  }

  // 410 — token invalid (expired, already redeemed, or wrong) — uniform message
  if (status === 410) {
    return {
      code: "token_invalid",
      message: "This invite link is no longer valid. Ask an admin to generate a new one.",
    };
  }

  if (status === 400 || status === 422) {
    return { code: "validation", message: bodyMsg || "Validation error." };
  }
  if (status === 401) {
    return { code: "unauthorized", message: "Session expired. Please log in again." };
  }
  if (status === 404) {
    return { code: "not_found", message: "The requested resource was not found." };
  }
  if (status === 429) {
    return { code: "rate_limited", message: "Too many requests. Please wait and try again." };
  }

  const fallbackMsg = e.message ?? "An unexpected error occurred.";
  return { code: "generic", message: fallbackMsg };
}

// ---------------------------------------------------------------------------
// Company CRUD actions
// ---------------------------------------------------------------------------

export async function fetchMyCompaniesAction(): Promise<ActionResult<MyCompany[]>> {
  try {
    const data = await fetchMyCompanies();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function fetchAllCompaniesAction(opts?: {
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ items: Company[]; total: number }>> {
  try {
    const data = await fetchAllCompanies(opts);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function fetchCompanyAction(id: string): Promise<ActionResult<Company>> {
  try {
    const data = await fetchCompany(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function createCompanyAction(
  payload: CreateCompanyPayload
): Promise<ActionResult<Company>> {
  try {
    const data = await createCompany(payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function updateCompanyAction(
  id: string,
  payload: UpdateCompanyPayload
): Promise<ActionResult<Company>> {
  try {
    const data = await updateCompany(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function deleteCompanyAction(id: string): Promise<ActionResult<void>> {
  try {
    await deleteCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function setPrimaryCompanyAction(id: string): Promise<ActionResult<void>> {
  try {
    await setPrimaryCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function detachCompanyAction(id: string): Promise<ActionResult<void>> {
  try {
    await detachCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

// ---------------------------------------------------------------------------
// Invite token actions
// ---------------------------------------------------------------------------

/**
 * Generate (or regenerate) an invite token.
 * CALLER RESPONSIBILITY: surface data.token once via a dialog — do NOT log it.
 */
export async function generateInviteTokenAction(
  companyId: string,
  opts?: { regenerate?: boolean }
): Promise<ActionResult<CompanyInviteTokenGenerated>> {
  try {
    const data = await generateInviteToken(companyId, opts);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function revokeInviteTokenAction(companyId: string): Promise<ActionResult<void>> {
  try {
    await revokeInviteToken(companyId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function redeemInviteTokenAction(token: string): Promise<ActionResult<MyCompany>> {
  try {
    const data = await redeemInviteToken(token);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

// ---------------------------------------------------------------------------
// Attached-users actions
// ---------------------------------------------------------------------------

export async function fetchAttachedUsersAction(
  companyId: string
): Promise<ActionResult<AttachedUser[]>> {
  try {
    const data = await fetchAttachedUsers(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function bootAttachedUserAction(
  companyId: string,
  userId: string
): Promise<ActionResult<void>> {
  try {
    await bootAttachedUser(companyId, userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}
