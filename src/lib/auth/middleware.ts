/**
 * Auth middleware helpers
 * Utilities for route protection configuration.
 *
 * The route gate is a denylist: every route requires auth UNLESS its
 * pathname matches one of the public prefixes below. This way new
 * authenticated pages are protected by default — adding a route does
 * not require touching this file to keep it gated.
 */

// Routes that do NOT require authentication. Matched by prefix on the
// locale-stripped pathname. Any new public flow (e.g. /forgot-password)
// must be added here explicitly.
export const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
] as const;

// Routes that should redirect to dashboard if already authenticated.
export const authRoutes = ["/login"];

// Cookie names
export const ACCESS_TOKEN_COOKIE = "access_token_cookie";

/**
 * True when the pathname (without the locale prefix) is a public route.
 * Match by prefix so locale-stripped paths like "/accept-invite/abc123"
 * still resolve as public.
 */
export function isPublicRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * A route requires auth if it is NOT public. Inverting the allowlist
 * means a new top-level segment is gated by default.
 */
export function isProtectedRoute(pathname: string): boolean {
  return !isPublicRoute(pathname);
}

/**
 * Check if a pathname matches any auth routes (login, register, etc.)
 */
export function isAuthRoute(pathname: string): boolean {
  return authRoutes.some((route) => pathname.startsWith(route));
}
