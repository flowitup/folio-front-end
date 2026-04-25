"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User, AuthState, LoginCredentials } from "@/lib/auth/types";
import {
  login as loginAction,
  logout as logoutAction,
} from "@/lib/auth/actions";
import { setApiAccessToken } from "@/lib/api/http";

interface AuthContextType extends AuthState {
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  accessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null;
  initialAccessToken?: string | null;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialAccessToken = null,
}: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "en";
  const [isPending, startTransition] = useTransition();
  const [accessToken, setAccessToken] = useState<string | null>(initialAccessToken);
  const [state, setState] = useState<AuthState>({
    user: initialUser,
    isAuthenticated: !!initialUser,
    isLoading: false,
  });

  const isLoading = state.isLoading || isPending;

  // Sync access token with http module
  useEffect(() => {
    setApiAccessToken(accessToken);
  }, [accessToken]);

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
        if (result.accessToken) {
          setAccessToken(result.accessToken);
        }
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
    setAccessToken(null);

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
        accessToken,
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
