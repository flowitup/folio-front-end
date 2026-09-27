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

/**
 * Cookie-authenticated GET for binary downloads (PDF/XLSX exports, images).
 *
 * These call the backend with a raw `fetch` so they can read the body as a
 * Blob and the Content-Disposition header, which means they skip the `api`
 * wrapper's refresh-on-401. Without this, a download clicked after the
 * ~15 min access token has expired fails even though the session is alive.
 * Retries once after a successful refresh; any other status is returned as is.
 */
export async function fetchWithRefresh(url: string, init: RequestInit = {}): Promise<Response> {
  const request: RequestInit = { ...init, credentials: "include" };
  const response = await fetch(url, request);
  if (response.status !== 401) return response;
  const refreshed = await refreshAccessTokenViaCookie();
  return refreshed ? fetch(url, request) : response;
}
