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
const ACCESS_CSRF_COOKIE = "csrf_access_token";

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

/**
 * True when the Cookie header carries more than one access or refresh token
 * cookie. A script on a sibling host (the S3 origin) can plant a second copy
 * with a Domain attribute; Next reads the last copy and Flask the first, so
 * the page and the API would disagree on who is signed in.
 */
export function hasDuplicateSessionCookie(request: NextRequest): boolean {
  const counts = new Map<string, number>();
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const name = pair.split("=")[0].trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return (counts.get(ACCESS_TOKEN_COOKIE) ?? 0) > 1 || (counts.get(REFRESH_TOKEN_COOKIE) ?? 0) > 1;
}

const SESSION_COOKIES = [
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_CSRF_COOKIE,
  REFRESH_CSRF_COOKIE,
];

/**
 * Tell the browser to drop the session cookies, host-only and (for a planted
 * copy) on every parent domain, so a user whose cookies were doubled lands on
 * /login and can sign in again.
 */
export function expireSessionCookies(request: NextRequest, response: NextResponse): void {
  const host = request.nextUrl.hostname;
  const labels = /^[\d.]+$/.test(host) ? [] : host.split(".");
  const domains = [undefined, ...labels.slice(0, -1).map((_, i) => labels.slice(i).join("."))];
  for (const name of SESSION_COOKIES) {
    for (const domain of domains) {
      // Appended as raw headers: `response.cookies` keeps one cookie per name.
      response.headers.append(
        "set-cookie",
        `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ""}`
      );
    }
  }
}

/** Make the render of this request see no session cookies. */
export function forwardWithoutSessionCookies(request: NextRequest, response: NextResponse): void {
  const kept = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !SESSION_COOKIES.includes(pair.split("=")[0].trim()));
  forwardRequestHeader(request, response, "cookie", kept.join("; "));
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

  // Built from the raw incoming header: rebuilding it from decoded cookie
  // values would make a cookie holding CR/LF (junk=a%0D%0Ab) throw in
  // Headers.set on every refresh.
  const refreshedNames = new Set(cookies.map((c) => c.name));
  const kept = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !refreshedNames.has(pair.split("=")[0].trim()));
  const fresh = cookies.map((c) => `${c.name}=${headerSafeCookieValue(c.value)}`);

  forwardRequestHeader(request, response, "cookie", [...kept, ...fresh].join("; "));
}

/** A value as the API issues it (JWT, CSRF token) stays as is; anything else is percent-encoded. */
function headerSafeCookieValue(value: string): string {
  return /^[A-Za-z0-9._~+/=-]*$/.test(value) ? value : encodeURIComponent(value);
}

/**
 * Set a header on the request the page renders with.
 *
 * `response` comes from the next-intl middleware, so the request-header
 * override is merged into whatever it set rather than built with
 * NextResponse.next({ request }).
 */
export function forwardRequestHeader(
  request: NextRequest,
  response: NextResponse,
  name: string,
  value: string
): void {
  const header = name.toLowerCase();
  const existing = response.headers.get(OVERRIDE_HEADERS);
  if (existing) {
    const keys = new Set(existing.split(",").map((k) => k.trim()).filter(Boolean));
    keys.add(header);
    response.headers.set(OVERRIDE_HEADERS, [...keys].join(","));
    response.headers.set(`${REQUEST_HEADER_PREFIX}${header}`, value);
    return;
  }

  // No override yet: the list must name every request header, since Next
  // drops the headers an override list leaves out.
  const forwarded = new Headers(request.headers);
  forwarded.set(header, value);
  const keys: string[] = [];
  forwarded.forEach((headerValue, key) => {
    keys.push(key);
    response.headers.set(`${REQUEST_HEADER_PREFIX}${key}`, headerValue);
  });
  response.headers.set(OVERRIDE_HEADERS, keys.join(","));
}
