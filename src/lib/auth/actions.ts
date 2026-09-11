"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import type {
  LoginCredentials,
  LoginResponse,
  User,
  AcceptInvitePayload,
  RequestInviteCodePayload,
} from "./types";
import { acceptInvite, requestInviteCode } from "@/lib/api/invitations";
import { setForwardedCookies } from "./forward-cookies";
import { getCurrentUser } from "./session";

/**
 * Login server action.
 * Calls backend API and sets cookies.
 */
export async function login(
  credentials: LoginCredentials
): Promise<{ success: boolean; error?: string; user?: User; accessToken?: string }> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const body = await response.text();
      let errorMsg = "Invalid credentials";
      try { errorMsg = JSON.parse(body)?.message || errorMsg; } catch {}
      return {
        success: false,
        error: errorMsg,
      };
    }

    const data: LoginResponse = await response.json();

    // Forward cookies from backend response
    await setForwardedCookies(response.headers.getSetCookie());

    return {
      success: true,
      user: data.user,
      accessToken: data.access_token,
    };
  } catch (error) {
    // Log only the message; the full error object can carry the
    // outbound request body (credentials) on fetch failures and stack
    // lines we'd rather not stream into container logs.
    console.error(
      "Login error:",
      error instanceof Error ? error.message : "unknown"
    );
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
}

/**
 * Fetch the canonical current-user record via `GET /auth/me`.
 *
 * `POST /auth/login` does not reliably populate `user.companies` (backend
 * limitation — see `types.ts`), so callers that need an up-to-date company
 * list right after login (or after any action that can change company
 * membership) must re-fetch through this action rather than trust the
 * login response's embedded user. Relies on the cookies already set by
 * `login()` in the same request/response cycle.
 */
export async function getCurrentUserAction(): Promise<User | null> {
  return getCurrentUser();
}

/**
 * Logout server action.
 * Clears cookies, calls backend, then redirects.
 */
export async function logout(): Promise<never> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token_cookie")?.value;

  try {
    await fetch(`${env.apiBaseUrl}/auth/logout`, {
      method: "POST",
      headers: token ? { Cookie: `access_token_cookie=${token}` } : {},
    });
  } catch {
    // Continue even if backend call fails
  }

  // Clear all auth cookies
  cookieStore.delete("access_token_cookie");
  cookieStore.delete("refresh_token_cookie");
  cookieStore.delete("csrf_access_token");
  cookieStore.delete("csrf_refresh_token");

  redirect("/login");
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
  | "invalid_code"
  | "throttled"
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
  if (reason === "expired" || reason === "revoked" || reason === "accepted") return reason;
  switch (err?.status) {
    case 400:
      return "invalid_phone";
    case 401:
      return "invalid_code";
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
): Promise<{ success: boolean; error?: InviteFlowError }> {
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

