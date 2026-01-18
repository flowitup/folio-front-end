// Re-export auth utilities
export type {
  User,
  AuthSession,
  LoginCredentials,
  LoginResponse,
  AuthState,
} from "./types";

export { getSession, getCurrentUser, hasPermission, hasRole } from "./session";
export { login, logout, refreshToken } from "./actions";
export {
  protectedRoutes,
  authRoutes,
  isProtectedRoute,
  isAuthRoute,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_ACCESS_COOKIE,
  CSRF_REFRESH_COOKIE,
} from "./middleware";
