/**
 * How a user is labelled in the UI.
 *
 * Phone sign-ups have no real e-mail: the backend mints a synthetic
 * `phone-<number>@no-email.folio.flowitup.com` address (otp_login.py). That
 * address is an internal identifier and must never be shown as if it were
 * the person's e-mail, nor used for their initial (every such account would
 * read "P"). The name the user gave wins, then their phone, then a real e-mail.
 */

import { formatFrenchPhone } from "./phone-number";

const PLACEHOLDER_EMAIL = /@no-email\.folio\.flowitup\.com$/i;

type UserLike = {
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** True for the synthetic address the backend gives phone-only accounts. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && PLACEHOLDER_EMAIL.test(email.trim());
}

/** The user's real e-mail, or "" for a phone-only account. */
export function realEmail(user: UserLike | null | undefined): string {
  const email = user?.email?.trim() ?? "";
  return isPlaceholderEmail(email) ? "" : email;
}

/** How to reach the user: a real e-mail, else their phone, else "". */
export function userContact(user: UserLike | null | undefined): string {
  const email = realEmail(user);
  if (email) return email;
  const phone = user?.phone?.trim();
  return phone ? formatFrenchPhone(phone) : "";
}

/** Display label: the user's name, else their contact, else "". */
export function userDisplayName(user: UserLike | null | undefined): string {
  return user?.display_name?.trim() || userContact(user);
}

/** One-letter avatar initial, "·" when there is nothing to show. */
export function userInitial(user: UserLike | null | undefined): string {
  const label = user?.display_name?.trim() || realEmail(user);
  return label ? label.charAt(0).toUpperCase() : "·";
}
