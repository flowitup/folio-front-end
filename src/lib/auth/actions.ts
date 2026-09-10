"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import type { LoginCredentials, LoginResponse, User, AcceptInvitePayload } from "./types";
import { acceptInvite } from "@/lib/api/invitations";
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
export async function acceptInviteAction(
  token: string,
  name: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  // Server-side input validation (don't trust client)
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { success: false, error: "Invalid invitation token" };
  }
  if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    return { success: false, error: "Name must be between 1 and 100 characters" };
  }
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { success: false, error: "Password must be between 8 and 128 characters" };
  }

  try {
    const payload: AcceptInvitePayload = { token, name: name.trim(), password };
    const { user, setCookieHeaders } = await acceptInvite(payload);

    await setForwardedCookies(setCookieHeaders);

    return { success: true, user };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Accept invite error:", message);
    return { success: false, error: message };
  }
}

