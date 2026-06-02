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

import { getTranslations } from "next-intl/server";
import {
  fetchMyCompanies,
  fetchAllCompanies,
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
  setMemberRole,
} from "@/lib/api/companies/attached-users";
import { getSession } from "@/lib/auth/session";
import type { Company, MyCompany, CompanyInviteTokenGenerated, AttachedUser } from "@/types/companies";
import type { CreateCompanyPayload, UpdateCompanyPayload } from "@/lib/api/companies/companies";

// ---------------------------------------------------------------------------
// Shared result type (re-exported so callers can type-narrow)
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// Defense-in-depth: every action checks for a session locally before
// touching the BE. Keeps the action endpoint inert when no cookie is
// present, independent of any BE auth regression.
async function requireSession(): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  const session = await getSession();
  if (!session?.accessToken) {
    const t = await getTranslations("companies.errors");
    return { ok: false, error: { code: "unauthorized", message: t("unauthorized") } };
  }
  return { ok: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function invalid(): Promise<{
  ok: false;
  error: { code: string; message: string };
}> {
  const t = await getTranslations("companies.errors");
  return { ok: false, error: { code: "validation", message: t("validation") } };
}

// ---------------------------------------------------------------------------
// Internal error classifier
// ---------------------------------------------------------------------------

/**
 * Classify a backend error into a stable code + a localized user-facing message.
 *
 * Messages resolve through `getTranslations("companies.errors")` so the toast
 * surfaced in the UI always matches the active locale. Backend `body.message`
 * is intentionally NOT surfaced — the BE is not localized today, so trusting it
 * would leak English into fr/vi views and defeat the i18n parity guarantee.
 */
async function classifyBackendError(
  err: unknown
): Promise<{ code: string; message: string }> {
  const e = err as {
    status?: number;
    body?: Record<string, unknown> | null;
    message?: string;
  };
  const status = e.status;
  const body = e.body ?? {};
  const reason = typeof body["reason"] === "string" ? body["reason"] : "";

  const t = await getTranslations("companies.errors");

  // 403 — admin-only endpoint
  if (status === 403) {
    return { code: "forbidden_admin_required", message: t("forbiddenAdminRequired") };
  }

  // 409 conflicts — discriminate by reason
  if (status === 409) {
    if (reason === "company_already_attached") {
      return { code: "company_already_attached", message: t("companyAlreadyAttached") };
    }
    if (reason === "active_token_exists") {
      return { code: "active_token_exists", message: t("activeTokenExists") };
    }
    return { code: "conflict", message: t("conflict") };
  }

  // 410 — token invalid (expired, already redeemed, or wrong) — uniform message
  if (status === 410) {
    return { code: "token_invalid", message: t("tokenInvalid") };
  }

  if (status === 400 || status === 422) {
    return { code: "validation", message: t("validation") };
  }
  if (status === 401) {
    return { code: "unauthorized", message: t("unauthorized") };
  }
  if (status === 404) {
    return { code: "not_found", message: t("notFound") };
  }
  if (status === 429) {
    return { code: "rate_limited", message: t("rateLimited") };
  }

  return { code: "generic", message: t("generic") };
}

// ---------------------------------------------------------------------------
// Company CRUD actions
// ---------------------------------------------------------------------------

export async function fetchMyCompaniesAction(): Promise<ActionResult<MyCompany[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  try {
    const data = await fetchMyCompanies();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function fetchAllCompaniesAction(opts?: {
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ items: Company[]; total: number }>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  try {
    const data = await fetchAllCompanies(opts);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function createCompanyAction(
  payload: CreateCompanyPayload
): Promise<ActionResult<Company>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  try {
    const data = await createCompany(payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function updateCompanyAction(
  id: string,
  payload: UpdateCompanyPayload
): Promise<ActionResult<Company>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return invalid();
  try {
    const data = await updateCompany(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function deleteCompanyAction(id: string): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return invalid();
  try {
    await deleteCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function setPrimaryCompanyAction(id: string): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return invalid();
  try {
    await setPrimaryCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function detachCompanyAction(id: string): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(id)) return invalid();
  try {
    await detachCompany(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
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
  opts?: { regenerate?: boolean; role?: "admin" | "member" }
): Promise<ActionResult<CompanyInviteTokenGenerated>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  try {
    const data = await generateInviteToken(companyId, opts);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function revokeInviteTokenAction(companyId: string): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  try {
    await revokeInviteToken(companyId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function redeemInviteTokenAction(token: string): Promise<ActionResult<MyCompany>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!token || typeof token !== "string" || token.length > 512) return invalid();
  try {
    const data = await redeemInviteToken(token);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

// ---------------------------------------------------------------------------
// Attached-users actions
// ---------------------------------------------------------------------------

export async function fetchAttachedUsersAction(
  companyId: string
): Promise<ActionResult<AttachedUser[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  try {
    const data = await fetchAttachedUsers(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function bootAttachedUserAction(
  companyId: string,
  userId: string
): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(userId)) return invalid();
  try {
    await bootAttachedUser(companyId, userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

export async function setMemberRoleAction(
  companyId: string,
  userId: string,
  role: "admin" | "member"
): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(userId)) return invalid();
  if (role !== "admin" && role !== "member") return invalid();
  try {
    await setMemberRole(companyId, userId, role);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}
