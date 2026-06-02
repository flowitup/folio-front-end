"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, revokeInvitation } from "@/lib/api/invitations";
import type { CreateInvitationResult } from "@/lib/api/invitations";
import { updateMemberRole, removeMember } from "@/lib/api/members";
import { updateUser } from "@/lib/api/admin";
import { getSession } from "@/lib/auth/session";

function membersPath(projectId: string): string {
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them makes revalidatePath a silent no-op. Use the resolved
  // path template without route-group segments.
  return `/[locale]/projects/${projectId}/members`;
}

function rethrowWithStatus(err: unknown): never {
  const status = (err as { status?: number }).status ?? 500;
  throw Object.assign(new Error((err as Error)?.message ?? "Request failed"), { status });
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
 * Returns discriminated result kind for client-side toast selection.
 * Re-throws errors with `status` property so client can map 409/429.
 */
export async function inviteMemberAction(
  projectId: string,
  email: string,
  roleId: string
): Promise<CreateInvitationResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!isUuid(projectId) || !isUuid(roleId)) {
    throw Object.assign(new Error("Invalid identifiers"), { status: 400 });
  }
  if (!email || !isEmail(email)) {
    throw Object.assign(new Error("Invalid email"), { status: 400 });
  }

  const result = await createInvitation({ project_id: projectId, email, role_id: roleId });
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them here makes the call a silent no-op. Use the resolved
  // path template without route-group segments.
  revalidatePath(`/[locale]/projects/${projectId}/members`, "page");
  return result;
}

/**
 * Server action: revoke a pending invitation.
 */
export async function revokeInviteAction(
  invitationId: string,
  projectId: string
): Promise<void> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!isUuid(invitationId) || !isUuid(projectId)) {
    throw Object.assign(new Error("Invalid identifiers"), { status: 400 });
  }

  await revokeInvitation(invitationId);
  // Route groups like `(app)` are stripped from Next.js cache keys, so
  // including them here makes the call a silent no-op. Use the resolved
  // path template without route-group segments.
  revalidatePath(`/[locale]/projects/${projectId}/members`, "page");
}

/**
 * Server action: change a member's project role. Takes effect immediately
 * (membership-role permissions are resolved per request on the backend).
 */
export async function updateMemberRoleAction(
  projectId: string,
  userId: string,
  roleId: string
): Promise<void> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!isUuid(projectId) || !isUuid(userId) || !isUuid(roleId)) {
    throw Object.assign(new Error("Invalid identifiers"), { status: 400 });
  }

  try {
    await updateMemberRole(projectId, userId, roleId);
  } catch (err) {
    rethrowWithStatus(err);
  }
  revalidatePath(membersPath(projectId), "page");
}

/**
 * Server action: update a member's profile (email and/or display name).
 * Superadmin-only on the backend; email is the login identity.
 */
export async function updateUserProfileAction(
  projectId: string,
  userId: string,
  payload: { email?: string; display_name?: string | null }
): Promise<void> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!isUuid(projectId) || !isUuid(userId)) {
    throw Object.assign(new Error("Invalid identifiers"), { status: 400 });
  }
  if (payload.email !== undefined && !isEmail(payload.email)) {
    throw Object.assign(new Error("Invalid email"), { status: 400 });
  }

  try {
    await updateUser(userId, payload);
  } catch (err) {
    rethrowWithStatus(err);
  }
  revalidatePath(membersPath(projectId), "page");
}

/**
 * Server action: remove a member from the project.
 */
export async function removeMemberAction(projectId: string, userId: string): Promise<void> {
  const session = await getSession();
  if (!session?.accessToken) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!isUuid(projectId) || !isUuid(userId)) {
    throw Object.assign(new Error("Invalid identifiers"), { status: 400 });
  }

  try {
    await removeMember(projectId, userId);
  } catch (err) {
    rethrowWithStatus(err);
  }
  revalidatePath(membersPath(projectId), "page");
}
