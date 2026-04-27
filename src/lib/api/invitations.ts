/**
 * Invitations API wrapper
 * Typed wrappers for invitation-related backend endpoints.
 * Public routes (verify/accept) need no auth token.
 * Admin routes (list/create/revoke) require session cookie.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { User } from "@/lib/auth/types";
import type { VerifyInviteResponse, AcceptInvitePayload } from "@/lib/auth/types";

// ---- Admin invitation types ----

export interface PendingInvitation {
  id: string;
  email: string;
  role_name: string;
  expires_at: string;
  invited_by_name: string | null;
}

export interface CreateInvitationPayload {
  project_id: string;
  email: string;
  role_id: string;
}

export type CreateInvitationResult =
  | { kind: "invitation_sent"; invitation_id: string; expires_at: string }
  | { kind: "direct_added"; user_id: string };

/**
 * List pending invitations for a project.
 * Requires auth + project membership.
 */
export async function listInvitations(
  projectId: string,
  status = "pending"
): Promise<PendingInvitation[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/invitations?status=${encodeURIComponent(status)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing invitations: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to list invitations (HTTP ${response.status})`);
  }
  // BE returns InvitationListResponse { items: [...], total: N }; unwrap to array.
  const data: { items: PendingInvitation[] } = await response.json();
  return data.items ?? [];
}

/**
 * Create an invitation (or directly add existing user).
 * Returns a discriminated result with kind field.
 * Throws errors with a `status` property for 409/429 handling.
 */
export async function createInvitation(
  payload: CreateInvitationPayload
): Promise<CreateInvitationResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating invitation: ${String(err)}`);
  }
  if (!response.ok) {
    const err = new Error(`Failed to create invitation (HTTP ${response.status})`) as Error & {
      status: number;
    };
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/**
 * Revoke a pending invitation by id.
 * Requires auth + owner/admin permission.
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error revoking invitation: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to revoke invitation (HTTP ${response.status})`);
  }
}

export type InviteErrorReason = "expired" | "revoked" | "accepted" | "not_found";

/**
 * Verify an invitation token.
 * Returns invitation details on 200, or a discriminated error on 404/410.
 * Throws only on network errors or 5xx responses.
 */
export async function verifyInvite(
  token: string
): Promise<VerifyInviteResponse | { error: InviteErrorReason }> {
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/invitations/verify/${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error verifying invitation: ${String(err)}`);
  }

  if (response.status === 404) {
    return { error: "not_found" };
  }

  if (response.status === 410) {
    // Backend returns JSON with a reason field
    try {
      const body = await response.json();
      const reason = body?.reason as InviteErrorReason | undefined;
      if (reason === "expired" || reason === "revoked" || reason === "accepted") {
        return { error: reason };
      }
    } catch {
      // Body unreadable — default to expired
    }
    return { error: "expired" };
  }

  if (!response.ok) {
    throw new Error(`Unexpected response verifying invitation: HTTP ${response.status}`);
  }

  const data: VerifyInviteResponse = await response.json();
  return data;
}

/**
 * Accept an invitation.
 * Returns the created user plus raw Set-Cookie headers for the server action to forward.
 * Throws on any non-2xx response.
 */
export async function acceptInvite(
  payload: AcceptInvitePayload
): Promise<{ user: User; setCookieHeaders: string[] }> {
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error accepting invitation: ${String(err)}`);
  }

  if (!response.ok) {
    let message = `Failed to accept invitation (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      else if (body?.error) message = body.error;
    } catch {
      // ignore parse error
    }
    const err = new Error(message) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  const user: User = await response.json();
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

  return { user, setCookieHeaders };
}
