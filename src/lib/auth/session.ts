import { cookies } from "next/headers";
import { env } from "@/lib/config/env";
import type { User, AuthSession } from "./types";

const ACCESS_TOKEN_COOKIE = "access_token_cookie";

/**
 * Decode JWT payload (without verification - backend verifies).
 * Returns null if token format is invalid.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get current session from server-side cookies.
 * Use in Server Components and Server Actions.
 */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/me`, {
      headers: {
        Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const user: User = await response.json();

    // Parse expiry from JWT if possible, fallback to 30 min estimate
    const payload = decodeJwtPayload(token);
    const expiresAt = payload?.exp
      ? payload.exp * 1000
      : Date.now() + 30 * 60 * 1000;

    return {
      user,
      accessToken: token,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Get current user from session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Check if user has specific permission.
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.permissions.includes(permission);
}

/**
 * Check if user has specific role.
 */
export async function hasRole(role: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.roles.includes(role);
}
