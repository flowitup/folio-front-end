"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { env } from "@/lib/config/env";
import { clientIpHeader } from "@/lib/api/client-ip";
import type { User, AcceptInvitePayload, RequestInviteCodePayload } from "./types";
import { acceptInvite, acceptInviteAsMe, requestInviteCode } from "@/lib/api/invitations";
import { setForwardedCookies } from "./forward-cookies";
import { getCurrentUser, getSession } from "./session";
import { isTokenValid, REFRESH_TOKEN_COOKIE } from "./proxy-session";
import { postLoginPath } from "./callback-url";
import { hourlyLimitMinutes } from "./otp-throttle";

/**
 * Fetch the canonical current-user record via `GET /auth/me`.
 *
 * The sign-in response does not carry `user.companies` (see `types.ts`), so
 * callers that need an up-to-date company list right after sign-in (or after
 * any action that can change company membership) must re-fetch through this
 * action rather than trust the embedded user. Relies on the cookies already
 * forwarded by `verifyOtpAction` in the same request/response cycle.
 */
export async function getCurrentUserAction(): Promise<User | null> {
  return getCurrentUser();
}

/**
 * Logout server action.
 * Revokes the session on the backend, clears cookies, then redirects.
 *
 * The backend enforces CSRF on cookie-authenticated requests, so forwarding
 * the access cookie alone was refused with 401 before anything was revoked
 * and both tokens stayed usable after sign-out. The server-side call is not
 * a browser request, so it authenticates like the mobile app: the access
 * token as a Bearer header (only while unexpired: an expired one would fail
 * the whole request) and the refresh token in the JSON body.
 */
export async function logout(returnTo?: string): Promise<never> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token_cookie")?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isTokenValid(token) ? { Authorization: `Bearer ${token}` } : {}),
        ...(await clientIpHeader()),
      },
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Logout: backend answered ${response.status}; session may stay valid`);
    }
  } catch {
    // Continue even if backend call fails
  }

  // Clear all auth cookies
  cookieStore.delete("access_token_cookie");
  cookieStore.delete("refresh_token_cookie");
  cookieStore.delete("csrf_access_token");
  cookieStore.delete("csrf_refresh_token");

  // Every route is locale-prefixed: land on /<locale>/login like the rest, or
  // on the same-origin page the caller signed out to reach (an invitation for
  // another account). Same check as a sign-in callbackUrl, so no open redirect.
  const locale = await getLocale();
  const backTo = typeof returnTo === "string" && postLoginPath(returnTo, locale) === returnTo ? returnTo : null;
  redirect(backTo ?? `/${locale}/login`);
}

/**
 * Accept invitation server action.
 * Calls backend, forwards Set-Cookie headers, returns the created user.
 * Caller performs client-side redirect after success.
 */
/** Error kinds the invitation forms map to a translated message. */
export type InviteFlowError =
  | "invalid_phone"
  | "phone_registered"
  | "account_exists"
  | "wrong_account"
  | "invalid_code"
  | "throttled"
  | "hourly_limit"
  | "not_found"
  | "expired"
  | "revoked"
  | "accepted"
  | "unknown";

/**
 * Map a thrown invitations-API error onto a discriminator the form can translate.
 *
 * The backend sends `reason` on 409/410 (see the invitations routes), which is
 * what separates "this phone already has an account" from "this invitation
 * expired" — both of which the user can actually act on, differently.
 */
function classifyInviteError(error: unknown): InviteFlowError {
  const err = error as { status?: number; reason?: string } | null;
  const reason = err?.reason;
  if (reason === "phone_registered") return "phone_registered";
  // The invited address already has an account: only its own phone (or its session) accepts.
  if (reason === "account_exists") return "account_exists";
  if (reason === "expired" || reason === "revoked" || reason === "accepted") return reason;
  switch (err?.status) {
    case 400:
      return "invalid_phone";
    case 401:
      return "invalid_code";
    case 403:
      return "wrong_account";
    case 404:
      return "not_found";
    case 429:
      return "throttled";
    default:
      return "unknown";
  }
}

/**
 * Text a sign-in code to the phone number an invitee is claiming.
 *
 * The invitation token is the authorisation here — the invitee has no session
 * yet — so this stays a public call, rate-limited server-side.
 */
export async function requestInviteCodeAction(
  token: string,
  phone: string
): Promise<{ success: boolean; error?: InviteFlowError; retryAfterMinutes?: number }> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { success: false, error: "not_found" };
  }
  if (!phone || typeof phone !== "string") {
    return { success: false, error: "invalid_phone" };
  }

  try {
    const payload: RequestInviteCodePayload = { token, phone };
    await requestInviteCode(payload);
    return { success: true };
  } catch (error) {
    console.error(
      "Request invite code error:",
      error instanceof Error ? error.message : "unknown"
    );
    // The number's hourly code cap lasts up to an hour: say how long, not "wait a minute".
    const err = error as { status?: number; code?: string; retryAfter?: string | null } | null;
    const minutes = err?.status === 429 ? hourlyLimitMinutes(err.code, err.retryAfter) : null;
    if (minutes !== null) return { success: false, error: "hourly_limit", retryAfterMinutes: minutes };
    return { success: false, error: classifyInviteError(error) };
  }
}

/**
 * Accept an invitation as the signed-in user: someone who already has an
 * account joins from their session, without a phone step. The backend checks
 * the session's account is the one the invitation was sent to.
 */
export async function acceptInviteAsMeAction(
  token: string
): Promise<{ success: boolean; error?: InviteFlowError; projectId?: string }> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { success: false, error: "not_found" };
  }
  const session = await getSession();
  if (!session?.accessToken) return { success: false, error: "wrong_account" };

  try {
    const { project_id } = await acceptInviteAsMe(token);
    return { success: true, projectId: project_id };
  } catch (error) {
    console.error(
      "Accept invite as me error:",
      error instanceof Error ? error.message : "unknown"
    );
    return { success: false, error: classifyInviteError(error) };
  }
}

/**
 * Accept an invitation with a verified phone number.
 *
 * The invitee proves the phone by SMS code rather than choosing a password —
 * phone + code is the only way into Folio, so the account they end up with must
 * be one they can actually sign back into.
 */
export async function acceptInviteAction(
  token: string,
  name: string,
  phone: string,
  code: string
): Promise<{ success: boolean; error?: InviteFlowError; user?: User }> {
  // Server-side input validation (don't trust client)
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { success: false, error: "not_found" };
  }
  if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    return { success: false, error: "unknown" };
  }
  if (!phone || typeof phone !== "string") {
    return { success: false, error: "invalid_phone" };
  }
  if (!/^\d{6}$/.test(code?.trim() ?? "")) {
    return { success: false, error: "invalid_code" };
  }

  try {
    const payload: AcceptInvitePayload = {
      token,
      name: name.trim(),
      phone,
      code: code.trim(),
    };
    const { user, setCookieHeaders } = await acceptInvite(payload);

    await setForwardedCookies(setCookieHeaders);

    return { success: true, user };
  } catch (error) {
    console.error(
      "Accept invite error:",
      error instanceof Error ? error.message : "unknown"
    );
    return { success: false, error: classifyInviteError(error) };
  }
}

