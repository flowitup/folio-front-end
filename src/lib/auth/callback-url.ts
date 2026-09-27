/**
 * The page to return to after sign-in, from the `callbackUrl` the proxy puts
 * on /login. Only a same-origin path is accepted ("/…", not "//host", no
 * backslash or control characters), so the parameter cannot be used as an
 * open redirect.
 */
export function safeCallbackPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}
