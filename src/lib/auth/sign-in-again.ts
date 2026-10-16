/**
 * Send a user whose session expired to the sign-in page, back to `returnPath`
 * (under the current locale) once signed in. Reads the locale from the
 * address bar, so a component can call it without a locale hook.
 */

import { defaultLocale, locales } from "@/i18n/config";

export function signInAgainUrl(pathname: string, returnPath: string): string {
  const first = pathname.split("/")[1] ?? "";
  const locale = (locales as readonly string[]).includes(first) ? first : defaultLocale;
  return `/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}${returnPath}`)}`;
}

export function signInAgain(returnPath: string): void {
  window.location.assign(signInAgainUrl(window.location.pathname, returnPath));
}
