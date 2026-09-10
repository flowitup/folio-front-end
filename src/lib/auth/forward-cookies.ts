import { cookies } from "next/headers";
import { parseCookie } from "./cookie-parser";

/**
 * Forward Set-Cookie headers from the BE auth response onto the Next.js
 * cookie store, preserving each cookie's HttpOnly / Max-Age / SameSite /
 * Path attributes from the original. Critical for the CSRF cookies (which
 * MUST stay JS-readable) and for refresh-token lifetime (which must outlive
 * the browser session).
 *
 * Not a "use server" module by itself — it is a plain helper imported by
 * several server-action files (login, invite-accept, OTP verify) that each
 * carry their own "use server" directive. Splitting it out keeps that
 * forwarding logic in one place instead of duplicated per action file.
 */
export async function setForwardedCookies(setCookieHeaders: string[]): Promise<void> {
  const cookieStore = await cookies();
  // Defense-in-depth: never demote Secure. If the backend marks a cookie
  // Secure, forward that verbatim. Independently of that, always force
  // Secure in production runtimes so a misconfigured BE in prod cannot
  // accidentally issue a plaintext-capable session cookie.
  const isProdRuntime = process.env.NODE_ENV === "production";
  for (const cookie of setCookieHeaders) {
    const parsed = parseCookie(cookie);
    if (!parsed) continue;
    cookieStore.set(parsed.name, parsed.value, {
      httpOnly: parsed.httpOnly,
      secure: parsed.secure || isProdRuntime,
      sameSite: parsed.sameSite ?? "lax",
      path: parsed.path ?? "/",
      ...(parsed.maxAge !== undefined ? { maxAge: parsed.maxAge } : {}),
    });
  }
}
