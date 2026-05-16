"use client";

/**
 * Shared helper: refresh the in-memory access token via the HttpOnly refresh cookie.
 *
 * Used by both the project-document blob helper (GET /download) and the upload XHR
 * (POST /documents) so the token-refresh dance lives in one place.
 *
 * Returns the new access token on success, or null if the refresh fails.
 */

import { env } from "@/lib/config/env";
import { getRefreshCsrfToken, setApiAccessToken } from "@/lib/api/http";

export async function refreshAccessTokenViaCookie(): Promise<string | null> {
  try {
    const csrfRefresh = getRefreshCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfRefresh) headers["X-CSRF-TOKEN"] = csrfRefresh;
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.access_token) {
      setApiAccessToken(data.access_token);
      return data.access_token as string;
    }
    return null;
  } catch {
    return null;
  }
}
