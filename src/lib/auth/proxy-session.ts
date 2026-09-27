/**
 * Server-side session renewal for the proxy (src/proxy.ts).
 *
 * The access token lives 30 minutes and the refresh token 7 days. Without a
 * renewal on page loads, a full navigation, reload or new tab after 30 minutes
 * sent a signed-in user to /login although the refresh cookie was still good:
 * only client-side API calls ever refreshed. The proxy now refreshes with the
 * refresh cookie first, sets the new cookies on the browser and hands them to
 * the render of the same request.
 *
 * Cookie names and paths are Flask-JWT-Extended's defaults as configured in
 * folio-back-end (config/__init__.py sets no *_COOKIE_NAME / *_COOKIE_PATH),
 * so the refresh cookie and its CSRF twin are sent on every path, the proxy
 * included.
 */

import type { NextRequest, NextResponse } from "next/server";
import { clientIpHeaderFrom } from "@/lib/api/client-ip";
import { env } from "@/lib/config/env";
import { parseCookie, type ParsedCookie } from "./cookie-parser";
import { forwardedCookieOptions } from "./forward-cookies";
import { ACCESS_TOKEN_COOKIE } from "./middleware";

export const REFRESH_TOKEN_COOKIE = "refresh_token_cookie";
const REFRESH_CSRF_COOKIE = "csrf_refresh_token";

/**
 * Decode JWT and check if expired (without verification).
 * Returns true if token exists and is not expired.
 */
export function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true; // No expiry = assume valid
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Trade the request's refresh cookie for a new access token. Returns the
 * cookies the API set (the access token and its CSRF cookie), or an empty
 * list when there is no refresh cookie or the API refuses it.
 */
export async function refreshSession(request: NextRequest): Promise<ParsedCookie[]> {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return [];

  const headers: Record<string, string> = {
    Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}`,
    ...clientIpHeaderFrom(request.headers),
  };
  const csrf = request.cookies.get(REFRESH_CSRF_COOKIE)?.value;
  if (csrf) headers["X-CSRF-TOKEN"] = csrf;

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const cookies = response.headers
      .getSetCookie()
      .map(parseCookie)
      .filter((c): c is ParsedCookie => c !== null);
    return cookies.some((c) => c.name === ACCESS_TOKEN_COOKIE) ? cookies : [];
  } catch {
    return [];
  }
}

const OVERRIDE_HEADERS = "x-middleware-override-headers";
const REQUEST_HEADER_PREFIX = "x-middleware-request-";

/**
 * Put refreshed cookies on the browser (Set-Cookie) and on the request the
 * page renders with, so server components and actions of this very request
 * already see the new access token.
 *
 * `response` comes from the next-intl middleware, so the request-header
 * override is merged into whatever it set rather than built with
 * NextResponse.next({ request }).
 */
export function applySessionCookies(
  request: NextRequest,
  response: NextResponse,
  cookies: ParsedCookie[]
): void {
  if (cookies.length === 0) return;

  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, forwardedCookieOptions(cookie));
  }

  const jar = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  for (const cookie of cookies) jar.set(cookie.name, cookie.value);
  const cookieHeader = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

  const existing = response.headers.get(OVERRIDE_HEADERS);
  if (existing) {
    const keys = new Set(existing.split(",").map((k) => k.trim()).filter(Boolean));
    keys.add("cookie");
    response.headers.set(OVERRIDE_HEADERS, [...keys].join(","));
    response.headers.set(`${REQUEST_HEADER_PREFIX}cookie`, cookieHeader);
    return;
  }

  // No override yet: the list must name every request header, since Next
  // drops the headers an override list leaves out.
  const forwarded = new Headers(request.headers);
  forwarded.set("cookie", cookieHeader);
  const keys: string[] = [];
  forwarded.forEach((value, key) => {
    keys.push(key);
    response.headers.set(`${REQUEST_HEADER_PREFIX}${key}`, value);
  });
  response.headers.set(OVERRIDE_HEADERS, keys.join(","));
}
