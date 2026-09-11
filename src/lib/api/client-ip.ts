/**
 * Hand the caller's IP address to the backend on server-side calls.
 *
 * A request made from a server action or a server component reaches the API from the
 * frontend container, so the API sees one and the same address for every visitor. Its
 * rate limits are keyed on that address — five sign-in code requests a minute, and a
 * hundred requests a minute overall — which would make those limits shared by the whole
 * web app instead of applying per person.
 *
 * The address is sent as a single-value `X-Forwarded-For`, which the API honours only when
 * its own `TRUSTED_PROXY_HOPS` says a proxy is in front of it.
 *
 * Server-only — relies on next/headers, which is unavailable in client code.
 */

import { headers } from "next/headers";

/**
 * Conservative address shape: IPv4, IPv6 and IPv4-mapped IPv6 all fit, while `unknown`, a
 * quoted token, an oversized blob and anything carrying CR/LF do not. Whatever passes goes
 * out in a header and becomes a rate-limit key on the other side, and a CR/LF would make
 * `fetch` throw inside a helper that every server render awaits, so the bar is "looks like
 * an address or is not sent at all".
 */
const IP_SHAPED = /^[0-9a-f:.]{3,45}$/i;

export async function clientIpHeader(): Promise<Record<string, string>> {
  const incoming = await headers();
  // Cloudflare sets cf-connecting-ip itself and overwrites whatever the caller sent, so it
  // is the one value here that cannot be forged. Without it (local development, or any
  // deployment that is not behind Cloudflare) fall back to the last x-forwarded-for entry:
  // entries are appended hop by hop, so the last one is what a real proxy observed rather
  // than what the caller claimed about itself.
  const forwarded = incoming.get("x-forwarded-for")?.split(",").pop()?.trim();
  const clientIp = incoming.get("cf-connecting-ip")?.trim() || forwarded || "";
  return IP_SHAPED.test(clientIp) ? { "X-Forwarded-For": clientIp } : {};
}
