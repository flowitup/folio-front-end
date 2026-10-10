/**
 * Where to land after sign-in.
 *
 * The proxy sends a signed-out visitor of a protected page to
 * /{locale}/login?callbackUrl=<the page>. Only a same-origin path is honoured:
 * "//evil.example" and "/\evil.example" are protocol-relative to browsers, and
 * anything else (absolute URLs, empty, missing) falls back to the dashboard,
 * so the parameter cannot be used as an open redirect.
 */
export function postLoginPath(callbackUrl: string | null | undefined, locale: string): string {
  const fallback = `/${locale}/dashboard`;
  if (!callbackUrl || !callbackUrl.startsWith("/")) return fallback;
  // A backslash reads as "/" to browsers, and control characters (tab,
  // newline) are stripped by URL parsing, so "/\\evil" or "/\t/evil" would
  // become "//evil".
  if (callbackUrl.startsWith("//") || callbackUrl.includes("\\")) return fallback;
  if ([...callbackUrl].some((ch) => ch.charCodeAt(0) < 0x20)) return fallback;
  // Never bounce back to the sign-in page itself.
  if (/^\/[a-z]{2}\/login(?:[/?#]|$)/.test(callbackUrl) || /^\/login(?:[/?#]|$)/.test(callbackUrl)) {
    return fallback;
  }
  return callbackUrl;
}

/**
 * The sign-in page for a visitor whose session was refused while opening
 * `requestedPath`, carrying it as callbackUrl when postLoginPath would honour it.
 */
export function loginPathFor(requestedPath: string | null | undefined, locale: string): string {
  const login = `/${locale}/login`;
  if (!requestedPath || postLoginPath(requestedPath, locale) !== requestedPath) return login;
  return `${login}?callbackUrl=${encodeURIComponent(requestedPath)}`;
}
