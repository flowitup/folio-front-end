/**
 * Auth TypeScript types
 * Shared types for authentication across frontend
 */

export interface User {
  id: string;
  email: string;
  permissions: string[];
  roles: string[];
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
