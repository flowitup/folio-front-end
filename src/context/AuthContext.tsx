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
  getCurrentUserAction,
} from "@/lib/auth/actions";
import { verifyOtpAction } from "@/lib/auth/otp-actions";

interface AuthContextType extends AuthState {
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (
    phone: string,
    code: string
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

  // Shared post-login handling for both email/password and phone/SMS-code
  // sign-in, extracted so the two paths cannot drift out of sync — each
  // must re-fetch the canonical user and navigate the exact same way.
  const completeLogin = useCallback(
    async (loggedInUser: User) => {
      // POST /auth/login does not reliably populate `user.companies`
      // (see types.ts). Re-fetch via /auth/me (same cookies, already
      // forwarded by loginAction) so gates that read companies right
      // after login (onboarding, "New project", Settings › Company)
      // see the real list instead of an empty one. Fall back to the
      // login response's embedded user — merging in any `companies` it
      // did carry — if the re-fetch itself fails.
      const freshUser = await getCurrentUserAction();
      const user = freshUser ?? {
        ...loggedInUser,
        companies: loggedInUser.companies ?? [],
      };
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
      // A trailing router.refresh() here used to silently strand the user
      // on /login: push() starts an async RSC fetch for /dashboard without
      // blocking, and calling refresh() in the same tick issues a second
      // router action before push's navigation has committed — the router
      // ends up refreshing the CURRENT route (still /login at dispatch
      // time) instead of landing on the pushed one, so the URL never
      // changes even though the /dashboard fetch itself succeeded (caught
      // live via Playwright: window.location.href stayed on /login with
      // no console error). Confirmed unnecessary besides that: /dashboard
      // is never in the client Router Cache at this point (login always
      // starts from /login, under the same not-yet-visited route), so
      // push() alone already fetches every layout server-side fresh,
      // including the session-reading root layout.
      router.push(`/${locale}/dashboard`);
    },
    [router, locale]
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const result = await loginAction(credentials);

      if (result.success && result.user) {
        await completeLogin(result.user);
        return { success: true };
      }

      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error };
    },
    [completeLogin]
  );

  const loginWithPhone = useCallback(
    async (phone: string, code: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      const result = await verifyOtpAction(phone, code);

      if (result.success && result.user) {
        await completeLogin(result.user);
        return { success: true };
      }

      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error };
    },
    [completeLogin]
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
        loginWithPhone,
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
