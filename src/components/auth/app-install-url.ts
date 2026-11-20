/**
 * Where people get the Folio mobile app (store or download page), the web twin of the mobile
 * app's `EXPO_PUBLIC_APP_INSTALL_URL`. A deployment setting that may be unset: the sign-in card
 * then names the app without a link.
 */
export function appInstallUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_INSTALL_URL?.trim() || null;
}
