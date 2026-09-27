import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { locales, defaultLocale } from "@/i18n/config";
import {
  ACCESS_TOKEN_COOKIE,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/auth/middleware";
import {
  applySessionCookies,
  isTokenValid,
  refreshSession,
} from "@/lib/auth/proxy-session";

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Run i18n middleware first to handle locale detection/redirect
  const response = intlMiddleware(request);

  // Extract the pathname without locale prefix for auth checks. Strip
  // exactly the leading "/<locale>" segment if present so denylist
  // matching is locale-agnostic.
  const pathnameWithoutLocale =
    pathname.replace(new RegExp(`^/(${locales.join("|")})(?=/|$)`), "") || "/";

  // Check for access token cookie and validate expiry. An expired or missing
  // access token is renewed with the refresh cookie before anything decides
  // the user is signed out: the refresh token outlives it by days.
  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const needsSession =
    isProtectedRoute(pathnameWithoutLocale) || isAuthRoute(pathnameWithoutLocale);
  const refreshed =
    needsSession && !isTokenValid(accessToken) ? await refreshSession(request) : [];
  accessToken = refreshed.find((c) => c.name === ACCESS_TOKEN_COOKIE)?.value ?? accessToken;
  const isAuthenticated = isTokenValid(accessToken);

  // Get the current locale from pathname or default
  const localeMatch = pathname.match(new RegExp(`^/(${locales.join("|")})(?=/|$)`));
  const locale = localeMatch ? localeMatch[1] : defaultLocale;

  // Auth pages (/login) are never redirected from here. An unexpired token
  // may still be refused by the API (account deleted, token revoked, secret
  // rotated); bouncing it to /dashboard looped with the app layout sending it
  // back to /login. The login page redirects a signed-in user itself, after
  // the API has accepted the session.

  // Default-deny: every route requires auth unless it's on the public
  // denylist (login, accept-invite, etc). Adding a new authenticated
  // route no longer requires touching this file.
  if (!isAuthenticated && isProtectedRoute(pathnameWithoutLocale)) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  applySessionCookies(request, response, refreshed);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder files
     * - api routes
     * - analysis-report (the analyses viewer proxy route; it is not a
     *   localized page and must not be redirected to /<locale>/...)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api|analysis-report).*)",
  ],
};
