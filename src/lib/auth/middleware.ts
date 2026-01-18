/**
 * Auth middleware helpers
 * Utilities for route protection configuration
 */

// Routes that require authentication
export const protectedRoutes = ["/dashboard", "/projects", "/settings"];

// Routes that should redirect to dashboard if authenticated
export const authRoutes = ["/login"];

// Cookie names
export const ACCESS_TOKEN_COOKIE = "access_token_cookie";
export const REFRESH_TOKEN_COOKIE = "refresh_token_cookie";
export const CSRF_ACCESS_COOKIE = "csrf_access_token";
export const CSRF_REFRESH_COOKIE = "csrf_refresh_token";

/**
 * Check if a pathname matches any protected routes
 */
export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}

/**
 * Check if a pathname matches any auth routes (login, register, etc.)
 */
export function isAuthRoute(pathname: string): boolean {
  return authRoutes.some((route) => pathname.startsWith(route));
}
