/**
 * Invitations API wrapper
 * Typed wrappers for invitation-related backend endpoints.
 * Used from server components and server actions (no client token needed — routes are public).
 */

import { env } from "@/lib/config/env";
import type { User } from "@/lib/auth/types";
import type { VerifyInviteResponse, AcceptInvitePayload } from "@/lib/auth/types";

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
