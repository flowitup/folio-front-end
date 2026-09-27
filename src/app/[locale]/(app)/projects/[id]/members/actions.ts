"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, revokeInvitation } from "@/lib/api/invitations";
import type { CreateInvitationResult } from "@/lib/api/invitations";
import { unassignProjectMember } from "@/lib/api/assignments";
import { removeMember as removeMemberLegacy } from "@/lib/api/members";
import { updateUser } from "@/lib/api/admin";
import { getSession } from "@/lib/auth/session";

function membersPath(projectId: string): string {
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them makes revalidatePath a silent no-op. Use the resolved
  // path template without route-group segments.
  return `/[locale]/projects/${projectId}/members`;
}

/**
 * What a member action returns. Errors come back as values, never thrown:
 * in a production build Next strips everything but a digest from an error
 * thrown out of a server action, so a thrown `status` never reached the
 * client and every failure read as a generic 500.
 */
export type MemberActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; status: number };

function failure(status: number): { ok: false; status: number } {
  return { ok: false, status };
}

function statusOf(err: unknown): number {
  const status = (err as { status?: number } | null)?.status;
  return typeof status === "number" ? status : 500;
}

// Defense-in-depth: every mutating server action is an internet-reachable
// POST endpoint on the Next.js server. The BE is the source of truth for
// authz, but a single regression there (e.g. cookie not forwarded, or 401
// misreported as 200) would let unauthenticated callers proxy mutations.
// A local getSession() check upfront short-circuits before any BE call.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Minimal RFC-5322-ish email shape — same level as the BE accepts.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Server action: invite a member (or directly add existing user) to a project.
 * Returns the discriminated result kind for client-side toast selection, or
 * the failure status so the client can map 409/429.
 */
export async function inviteMemberAction(
  projectId: string,
  email: string
): Promise<MemberActionResult<CreateInvitationResult>> {
  const session = await getSession();
  if (!session?.accessToken) return failure(401);
  if (!isUuid(projectId)) return failure(400);
  if (!email || !isEmail(email)) return failure(400);

  let result: CreateInvitationResult;
  try {
    result = await createInvitation({ project_id: projectId, email });
  } catch (err) {
    return failure(statusOf(err));
  }
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them here makes the call a silent no-op. Use the resolved
  // path template without route-group segments.
  revalidatePath(`/[locale]/projects/${projectId}/members`, "page");
  return { ok: true, data: result };
}

/**
 * Server action: revoke a pending invitation.
 */
export async function revokeInviteAction(
  invitationId: string,
  projectId: string
): Promise<MemberActionResult> {
  const session = await getSession();
  if (!session?.accessToken) return failure(401);
  if (!isUuid(invitationId) || !isUuid(projectId)) return failure(400);

  try {
    await revokeInvitation(invitationId);
  } catch (err) {
    return failure(statusOf(err));
  }
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them here makes the call a silent no-op. Use the resolved
  // path template without route-group segments.
  revalidatePath(`/[locale]/projects/${projectId}/members`, "page");
  return { ok: true, data: null };
}

/**
 * Server action: update a member's profile (email and/or display name).
 * Superadmin-only on the backend; email is the login identity.
 */
export async function updateUserProfileAction(
  projectId: string,
  userId: string,
  payload: { email?: string; display_name?: string | null }
): Promise<MemberActionResult> {
  const session = await getSession();
  if (!session?.accessToken) return failure(401);
  if (!isUuid(projectId) || !isUuid(userId)) return failure(400);
  if (payload.email !== undefined && !isEmail(payload.email)) return failure(400);

  try {
    await updateUser(userId, payload);
  } catch (err) {
    return failure(statusOf(err));
  }
  revalidatePath(membersPath(projectId), "page");
  return { ok: true, data: null };
}

/**
 * Server action: remove an assigned manager/member from the project. The
 * single removal path for BOTH the project members page and the projects
 * list team panel (projects/page.tsx) — no separate client-side call exists.
 *
 * DELETE /projects/<id>/assignments/<userId> — the new insider-assignment
 * surface (assign via AssignMemberDialog, remove here). Falls back to the
 * legacy DELETE /projects/<id>/users/<userId> on a 404 so this keeps working
 * against a backend still on the pre-Phase-2/3 assignment contract (see the
 * BE Phase 2/3 vs 4 rollout note in the plan's Risk Assessment).
 */
export async function removeMemberAction(
  projectId: string,
  userId: string
): Promise<MemberActionResult> {
  const session = await getSession();
  if (!session?.accessToken) return failure(401);
  if (!isUuid(projectId) || !isUuid(userId)) return failure(400);

  try {
    await unassignProjectMember(projectId, userId);
  } catch (err) {
    if (statusOf(err) !== 404) return failure(statusOf(err));
    try {
      await removeMemberLegacy(projectId, userId);
    } catch (legacyErr) {
      return failure(statusOf(legacyErr));
    }
  }
  revalidatePath(membersPath(projectId), "page");
  return { ok: true, data: null };
}
