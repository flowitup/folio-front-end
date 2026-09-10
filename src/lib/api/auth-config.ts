import { env } from "@/lib/config/env";
import type { AuthConfig } from "@/lib/auth/types";

/**
 * Fetch which sign-in method(s) this deployment offers (`GET /auth/config`,
 * public, no auth). Server-only: called from the login page's server
 * component so the browser never hits the backend directly.
 *
 * Fallback on any failure (network error, non-2xx, malformed body) is
 * `login_mode: "phone"`, mirroring the mobile app's fallback: if the config
 * endpoint itself is unreachable, defaulting to email would silently hide
 * the only sign-in path for phone-only deployments (LOGIN_MODE=phone),
 * while phone-first degrades gracefully everywhere else — the login page
 * still offers a "Sign in with email instead" toggle when `login_mode` is
 * actually "both", but on a hard failure we cannot know that, so we pick
 * the option that is universally safe for phone-first deployments.
 */
export async function getAuthConfig(): Promise<AuthConfig> {
  const fallback: AuthConfig = { login_mode: "phone", session: "expiring", signup: false };

  try {
    const response = await fetch(`${env.apiBaseUrl}/auth/config`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    if (
      data &&
      (data.login_mode === "email" || data.login_mode === "phone" || data.login_mode === "both") &&
      (data.session === "persistent" || data.session === "expiring") &&
      typeof data.signup === "boolean"
    ) {
      return data as AuthConfig;
    }

    return fallback;
  } catch (error) {
    console.error("getAuthConfig error:", error instanceof Error ? error.message : "unknown");
    return fallback;
  }
}
