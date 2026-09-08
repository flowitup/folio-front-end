/**
 * Auth TypeScript types
 * Shared types for authentication across frontend
 */

import type { UserCompanySummary } from "./permissions";

export interface User {
  id: string;
  email: string;
  permissions: string[];
  /**
   * Companies the user is attached to (company-as-tenant model). Empty on the
   * POST /auth/login response (backend limitation — that endpoint does not
   * populate it); always populated on GET /auth/me. Defensive default to []
   * at every read site since older/legacy responses may omit it entirely.
   */
  companies?: UserCompanySummary[];
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface VerifyInviteResponse {
  email: string;
  project_name: string;
  role_name: string;
  inviter_name: string;
  expires_at: string;
}

export interface AcceptInvitePayload {
  token: string;
  name: string;
  password: string;
}
