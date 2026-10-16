import { cache } from "react";
import { cookies } from "next/headers";
import { clientIpHeader } from "@/lib/api/client-ip";
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
 * Last good `/auth/me` answer per access token, kept in this server process.
 * It is only used (up to STALE_MS old) when the API answers 429 or 5xx or
 * cannot be reached, so a busy API no longer signs everyone out; a normal
 * answer always wins, so permission or company changes show at once. Keyed
 * by the token, so it never crosses users; a 401 drops the entry at once.
 */
const STALE_MS = 10 * 60_000;
const MAX_ENTRIES = 500;
const lastGoodUser = new Map<string, { user: User; at: number }>();

function rememberUser(token: string, user: User): void {
  lastGoodUser.delete(token);
  lastGoodUser.set(token, { user, at: Date.now() });
  while (lastGoodUser.size > MAX_ENTRIES) {
    const oldest = lastGoodUser.keys().next().value;
    if (oldest === undefined) break;
    lastGoodUser.delete(oldest);
  }
}

function rememberedUser(token: string): User | null {
  const entry = lastGoodUser.get(token);
  if (!entry) return null;
  if (Date.now() - entry.at > STALE_MS) {
    lastGoodUser.delete(token);
    return null;
  }
  return entry.user;
}

/** Thrown when the session cannot be checked (API busy or down) and no recent answer is known. */
export class SessionCheckUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super(`session check unavailable${status ? ` (HTTP ${status})` : ""}`);
    this.name = "SessionCheckUnavailableError";
  }
}

/** For tests. */
export function clearSessionUserCache(): void {
  lastGoodUser.clear();
}

/**
 * Get current session from server-side cookies.
 * Use in Server Components and Server Actions.
 *
 * Wrapped in React's `cache()` so multiple calls within the same request
 * (e.g. a page and several sibling server components each calling
 * getSession()/getCurrentUser()) share one `GET /auth/me` round trip instead
 * of firing it once per caller. Request-scoped only — never leaks across
 * requests/users.
 *
 * Only an answer that says the token is not valid (401/403/422) means
 * "signed out". A 429 or 5xx (or no answer) falls back to the last good
 * answer for this token; without one it throws SessionCheckUnavailableError,
 * so the error page offers a retry instead of the sign-in page.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  // Parse expiry from JWT if possible, fallback to 30 min estimate
  const payload = decodeJwtPayload(token);
  const expiresAt = payload?.exp
    ? payload.exp * 1000
    : Date.now() + 30 * 60 * 1000;
  if (payload?.exp && expiresAt <= Date.now()) {
    lastGoodUser.delete(token);
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/auth/me`, {
      headers: {
        Cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
        ...(await clientIpHeader()),
      },
      cache: "no-store",
    });
  } catch {
    const stale = rememberedUser(token);
    if (stale) return { user: stale, accessToken: token, expiresAt };
    throw new SessionCheckUnavailableError(null);
  }

  if (response.status === 429 || response.status >= 500) {
    const stale = rememberedUser(token);
    if (stale) return { user: stale, accessToken: token, expiresAt };
    throw new SessionCheckUnavailableError(response.status);
  }

  if (!response.ok) {
    lastGoodUser.delete(token);
    return null;
  }

  try {
    const user: User = await response.json();
    rememberUser(token, user);
    return {
      user,
      accessToken: token,
      expiresAt,
    };
  } catch {
    return null;
  }
});

/**
 * Get current user from session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

