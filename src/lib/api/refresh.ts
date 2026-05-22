"use client";

/**
 * Shared helper: refresh the access token via the HttpOnly refresh cookie.
 *
 * The backend sets the refreshed access cookie via Set-Cookie; callers just
 * need to know whether the refresh succeeded so they can retry their request
 * with credentials:"include".
 */

import { env } from "@/lib/config/env";
import { getRefreshCsrfToken } from "@/lib/api/http";

export async function refreshAccessTokenViaCookie(): Promise<boolean> {
  try {
    const csrfRefresh = getRefreshCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfRefresh) headers["X-CSRF-TOKEN"] = csrfRefresh;
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}
