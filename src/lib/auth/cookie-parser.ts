/**
 * Parser for Set-Cookie header strings, used by server actions when forwarding
 * BE auth cookies onto the Next.js cookie store.
 *
 * Why this exists: previously the cookie was split on ';' and only name/value
 * were kept; setForwardedCookies then reapplied a hard-coded HttpOnly=true on
 * every cookie. That broke the CSRF cookies (csrf_access_token /
 * csrf_refresh_token) which MUST stay JS-readable so the SPA can echo them
 * back as X-CSRF-TOKEN. With those hidden, every mutation 401'd in
 * production where JWT_COOKIE_CSRF_PROTECT is on.
 */
export interface ParsedCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  maxAge?: number;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
}

export function parseCookie(cookie: string): ParsedCookie | null {
  const parts = cookie.split(";").map((p) => p.trim());
  const first = parts.shift();
  if (!first) return null;
  const eqIndex = first.indexOf("=");
  if (eqIndex === -1) return null;
  const name = first.slice(0, eqIndex).trim();
  const value = first.slice(eqIndex + 1).trim();
  if (!name || !value) return null;

  const result: ParsedCookie = { name, value, httpOnly: false };
  for (const attr of parts) {
    const [rawKey, ...rest] = attr.split("=");
    const key = rawKey.toLowerCase();
    const v = rest.join("=").trim();
    if (key === "httponly") result.httpOnly = true;
    else if (key === "max-age" && v) result.maxAge = Number(v);
    else if (key === "samesite" && v) {
      const lower = v.toLowerCase();
      if (lower === "strict" || lower === "lax" || lower === "none") {
        result.sameSite = lower;
      }
    } else if (key === "path" && v) result.path = v;
  }
  return result;
}
