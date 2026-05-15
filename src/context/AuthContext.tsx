"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User, AuthState, LoginCredentials } from "@/lib/auth/types";
import {
  login as loginAction,
  logout as logoutAction,
} from "@/lib/auth/actions";

interface AuthContextType extends AuthState {
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null;
}

// The JWT no longer lives in JS-readable memory: the HttpOnly
// access_token_cookie + CSRF cookie pair is the entire client auth
// surface. AuthContext exposes only the user identity, not the token.
export function AuthProvider({
  children,
  initialUser = null,
}: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthState>({
    user: initialUser,
    isAuthenticated: !!initialUser,
    isLoading: false,
  });

  const isLoading = state.isLoading || isPending;

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const result = await loginAction(credentials);

      if (result.success && result.user) {
        setState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });
        router.push(`/${locale}/dashboard`);
        router.refresh();
        return { success: true };
      }

      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error };
    },
    [router, locale]
  );

  const logout = useCallback(() => {
    // Clear local state immediately to prevent AuthErrorBoundary from triggering
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    startTransition(async () => {
      // Server action clears cookies and redirects to /login
      await logoutAction();
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
