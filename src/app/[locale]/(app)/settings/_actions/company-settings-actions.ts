"use server";

/**
 * Company self-service settings server actions — member directory, add-by-
 * phone, import, and the D8 grant/deny editor. Split out of
 * `companies-actions.ts` (already large) to keep each action file focused;
 * shares its discriminated ActionResult shape and error-classification
 * pattern.
 */

import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import {
  fetchCompanyDirectory,
  addMemberByPhone,
  importMembers,
  type AddMemberByPhoneResult,
  type CompanyDirectoryEntry,
  type ImportMembersResult,
} from "@/lib/api/companies-members";
import {
  listMemberGrants,
  setMemberGrant,
  removeMemberGrant,
  type MemberGrantRow,
  type MemberGrantsListResult,
  type GrantEffect,
} from "@/lib/api/member-grants";
import {
  assignProjectMember,
  unassignProjectMember,
  type ProjectAssignmentRole,
} from "@/lib/api/assignments";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        /** 409 add-by-phone: several un-linked profiles match the phone. */
        candidates?: { person_id: string; name: string }[];
        /** 409 add-by-phone: the phone already belongs to a person in this company. */
        personId?: string;
      };
    };

async function requireSession(): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  const session = await getSession();
  if (!session?.accessToken) {
    const t = await getTranslations("companySettings.errors");
    return { ok: false, error: { code: "unauthorized", message: t("unauthorized") } };
  }
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function invalid(): Promise<{
  ok: false;
  error: { code: string; message: string };
}> {
  const t = await getTranslations("companySettings.errors");
  return { ok: false, error: { code: "validation", message: t("validation") } };
}

async function classifyError(err: unknown): Promise<{ code: string; message: string }> {
  const e = err as { status?: number; body?: Record<string, unknown> | null };
  const status = e.status;
  const t = await getTranslations("companySettings.errors");

  if (status === 403) return { code: "forbidden", message: t("forbidden") };
  if (status === 404) return { code: "not_found", message: t("notFound") };
  if (status === 400 || status === 422) return { code: "validation", message: t("validation") };
  if (status === 401) return { code: "unauthorized", message: t("unauthorized") };
  if (status === 409) return { code: "conflict", message: t("conflict") };
  if (status === 429) return { code: "rateLimited", message: t("rateLimited") };
  return { code: "generic", message: t("generic") };
}

// ---------------------------------------------------------------------------
// Company directory
// ---------------------------------------------------------------------------

export async function fetchCompanyDirectoryAction(
  companyId: string
): Promise<ActionResult<CompanyDirectoryEntry[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  try {
    return { ok: true, data: await fetchCompanyDirectory(companyId) };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

// ---------------------------------------------------------------------------
// Add member by phone
// ---------------------------------------------------------------------------

export async function addMemberByPhoneAction(
  companyId: string,
  payload: { phone: string; name?: string; role?: "manager" | "member"; personId?: string }
): Promise<ActionResult<AddMemberByPhoneResult>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  if (!payload.phone || payload.phone.trim().length === 0) return invalid();
  if (payload.personId && !isUuid(payload.personId)) return invalid();

  try {
    const data = await addMemberByPhone(companyId, {
      phone: payload.phone.trim(),
      name: payload.name?.trim() || undefined,
      role: payload.role,
      person_id: payload.personId,
    });
    return { ok: true, data };
  } catch (err) {
    const e = err as { status?: number; body?: Record<string, unknown> | null };
    const body = e.body ?? {};
    // 409 with a candidates list — the caller must resend with person_id.
    if (e.status === 409 && Array.isArray(body["candidates"])) {
      const t = await getTranslations("companySettings.errors");
      return {
        ok: false,
        error: {
          code: "multiple_candidates",
          message: t("multipleCandidates"),
          candidates: body["candidates"] as { person_id: string; name: string }[],
        },
      };
    }
    // 409 — phone already belongs to a person in this company.
    if (e.status === 409 && typeof body["person_id"] === "string") {
      const t = await getTranslations("companySettings.errors");
      return {
        ok: false,
        error: {
          code: "phone_already_in_company",
          message: t("phoneAlreadyInCompany"),
          personId: body["person_id"] as string,
        },
      };
    }
    return { ok: false, error: await classifyError(err) };
  }
}

// ---------------------------------------------------------------------------
// Import members from another company
// ---------------------------------------------------------------------------

export async function importMembersAction(
  companyId: string,
  fromCompanyId: string,
  personIds: string[]
): Promise<ActionResult<ImportMembersResult>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(fromCompanyId)) return invalid();
  if (!Array.isArray(personIds) || personIds.length === 0 || !personIds.every(isUuid)) {
    return invalid();
  }
  try {
    const data = await importMembers(companyId, { from_company_id: fromCompanyId, person_ids: personIds });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

// ---------------------------------------------------------------------------
// D8 member grants
// ---------------------------------------------------------------------------

export async function listMemberGrantsAction(
  companyId: string,
  userId: string
): Promise<ActionResult<MemberGrantsListResult>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(userId)) return invalid();
  try {
    return { ok: true, data: await listMemberGrants(companyId, userId) };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

export async function setMemberGrantAction(
  companyId: string,
  userId: string,
  permission: string,
  effect: GrantEffect,
  projectId: string | null
): Promise<ActionResult<MemberGrantRow>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(userId)) return invalid();
  if (!permission) return invalid();
  if (projectId && !isUuid(projectId)) return invalid();
  try {
    const data = await setMemberGrant(companyId, userId, { permission, effect, project_id: projectId });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

export async function removeMemberGrantAction(
  companyId: string,
  userId: string,
  permission: string,
  projectId: string | null
): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(userId)) return invalid();
  if (!permission) return invalid();
  if (projectId && !isUuid(projectId)) return invalid();
  try {
    await removeMemberGrant(companyId, userId, { permission, project_id: projectId });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

// ---------------------------------------------------------------------------
// Project assignment (insiders — no invitation flow)
// ---------------------------------------------------------------------------

export async function assignProjectMemberAction(
  projectId: string,
  userId: string,
  role: ProjectAssignmentRole
): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(projectId) || !isUuid(userId)) return invalid();
  if (role !== "manager" && role !== "member") return invalid();
  try {
    await assignProjectMember(projectId, userId, role);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}

export async function unassignProjectMemberAction(
  projectId: string,
  userId: string
): Promise<ActionResult<void>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(projectId) || !isUuid(userId)) return invalid();
  try {
    await unassignProjectMember(projectId, userId);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: await classifyError(err) };
  }
}
