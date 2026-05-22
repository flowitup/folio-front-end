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

/**
 * Decode JWT and check if expired (without verification).
 * Returns true if token exists and is not expired.
 */
function isTokenValid(token: string | undefined): boolean {
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

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
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

  // Check for access token cookie and validate expiry
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isAuthenticated = isTokenValid(accessToken);

  // Get the current locale from pathname or default
  const localeMatch = pathname.match(new RegExp(`^/(${locales.join("|")})(?=/|$)`));
  const locale = localeMatch ? localeMatch[1] : defaultLocale;

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute(pathnameWithoutLocale)) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Default-deny: every route requires auth unless it's on the public
  // denylist (login, accept-invite, etc). Adding a new authenticated
  // route no longer requires touching this file.
  if (!isAuthenticated && isProtectedRoute(pathnameWithoutLocale)) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

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
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
};
