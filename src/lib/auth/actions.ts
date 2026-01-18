"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/config/env";
import type { LoginCredentials, LoginResponse, User } from "./types";

/**
 * Parse Set-Cookie header safely.
 * Handles values containing '=' characters.
 */
function parseCookie(cookie: string): { name: string; value: string } | null {
  const [nameValue] = cookie.split(";");
  const eqIndex = nameValue.indexOf("=");
  if (eqIndex === -1) return null;
  const name = nameValue.slice(0, eqIndex).trim();
  const value = nameValue.slice(eqIndex + 1).trim();
  return name && value ? { name, value } : null;
}

/**
 * Login server action.
 * Calls backend API and sets cookies.
 */
export async function login(
  credentials: LoginCredentials
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || "Invalid credentials",
      };
    }

    const data: LoginResponse = await response.json();

    // Forward cookies from backend response
    const setCookieHeaders = response.headers.getSetCookie();
    const cookieStore = await cookies();

    for (const cookie of setCookieHeaders) {
      const parsed = parseCookie(cookie);
      if (parsed) {
        cookieStore.set(parsed.name, parsed.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    }

    return {
      success: true,
      user: data.user,
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
 * Refresh token server action.
 */
export async function refreshToken(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("refresh_token_cookie")?.value;

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `refresh_token_cookie=${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    // Forward new cookies
    const setCookieHeaders = response.headers.getSetCookie();

    for (const cookie of setCookieHeaders) {
      const parsed = parseCookie(cookie);
      if (parsed) {
        cookieStore.set(parsed.name, parsed.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      }
    }

    return true;
  } catch {
    return false;
  }
}
