import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/middleware";

// Protected routes (without locale prefix)
const protectedRoutes = ["/dashboard", "/projects", "/settings"];
// Auth routes that redirect to dashboard if authenticated
const authRoutes = ["/login"];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return authRoutes.some((route) => pathname.startsWith(route));
}

// Create the next-intl middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export function middleware(request: NextRequest) {
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

  // Extract the pathname without locale prefix for auth checks
  const pathnameWithoutLocale = pathname.replace(
    new RegExp(`^/(${locales.join("|")})`),
    ""
  ) || "/";

  // Check for access token cookie
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isAuthenticated = !!accessToken;

  // Get the current locale from pathname or default
  const localeMatch = pathname.match(new RegExp(`^/(${locales.join("|")})`));
  const locale = localeMatch ? localeMatch[1] : defaultLocale;

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthRoute(pathnameWithoutLocale)) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Redirect unauthenticated users to login
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
