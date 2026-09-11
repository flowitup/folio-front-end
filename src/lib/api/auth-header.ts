/**
 * Shared helper to build the headers a server-side call to the API needs: the Bearer
 * Authorization from the session cookie, and the caller's IP so the backend's rate limits
 * count per visitor rather than per container (see ./client-ip).
 *
 * Used by every authenticated typed-fetch wrapper in src/lib/api/* (extracted in M5 to
 * remove the per-file duplication).
 *
 * Server-only — relies on next/headers which is unavailable in client code.
 */

import { cookies } from "next/headers";
import { clientIpHeader } from "./client-ip";

export async function sessionAuthHeader(): Promise<Record<string, string>> {
  const [cookieStore, ipHeader] = await Promise.all([cookies(), clientIpHeader()]);
  const token = cookieStore.get("access_token_cookie")?.value;
  if (!token) return ipHeader;
  return { Authorization: `Bearer ${token}`, ...ipHeader };
}
