"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import type { LoginCredentials, LoginResponse, User, AcceptInvitePayload } from "./types";
import { acceptInvite } from "@/lib/api/invitations";
import { parseCookie } from "./cookie-parser";

/**
 * Forward Set-Cookie headers from the BE auth response onto the Next.js
 * cookie store, preserving each cookie's HttpOnly / Max-Age / SameSite /
 * Path attributes from the original. Critical for the CSRF cookies (which
 * MUST stay JS-readable) and for refresh-token lifetime (which must outlive
 * the browser session).
 */
async function setForwardedCookies(setCookieHeaders: string[]): Promise<void> {
  const cookieStore = await cookies();
  // Defense-in-depth: never demote Secure. If the backend marks a cookie
  // Secure, forward that verbatim. Independently of that, always force
  // Secure in production runtimes so a misconfigured BE in prod cannot
  // accidentally issue a plaintext-capable session cookie.
  const isProdRuntime = process.env.NODE_ENV === "production";
  for (const cookie of setCookieHeaders) {
    const parsed = parseCookie(cookie);
    if (!parsed) continue;
    cookieStore.set(parsed.name, parsed.value, {
      httpOnly: parsed.httpOnly,
      secure: parsed.secure || isProdRuntime,
      sameSite: parsed.sameSite ?? "lax",
      path: parsed.path ?? "/",
      ...(parsed.maxAge !== undefined ? { maxAge: parsed.maxAge } : {}),
    });
  }
}

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
    console.error("Login error:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
    };
  }
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
    console.error("Accept invite error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

/**
 * Refresh token server action.
 */
export async function refreshToken(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("refresh_token_cookie")?.value;
  // Flask-JWT-Extended requires the refresh-token CSRF header on POST /auth/refresh
  // when JWT_COOKIE_CSRF_PROTECT is on (production default). The CSRF token is
  // SEPARATE from the access-token CSRF, so we must read csrf_refresh_token here.
  const csrfRefresh = cookieStore.get("csrf_refresh_token")?.value;

  if (!token) {
    return false;
  }

  try {
    const headers: Record<string, string> = {
      Cookie: `refresh_token_cookie=${token}${csrfRefresh ? `; csrf_refresh_token=${csrfRefresh}` : ""}`,
    };
    if (csrfRefresh) {
      headers["X-CSRF-TOKEN"] = csrfRefresh;
    }
    const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      return false;
    }

    // Forward new cookies
    await setForwardedCookies(response.headers.getSetCookie());

    return true;
  } catch {
    return false;
  }
}
