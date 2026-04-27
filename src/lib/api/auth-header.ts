/**
 * Shared helper to build a Bearer Authorization header from the server-side
 * session cookie. Used by every authenticated typed-fetch wrapper in
 * src/lib/api/* (extracted in M5 to remove the per-file duplication).
 *
 * Server-only — relies on next/headers which is unavailable in client code.
 */

import { cookies } from "next/headers";

export async function sessionAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token_cookie")?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
