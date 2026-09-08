/**
 * Server-side billing-access gate.
 *
 * Billing is per-company, admin-gated: a user may see/manage billing only if
 * they are platform ops (D5) OR hold the "admin" role in at least one company
 * they belong to. Used to gate the billing nav group and billing pages.
 *
 * Thin wrapper around `isCompanyAdmin()` (permissions.ts) — kept as its own
 * file (rather than inlined at call sites) because it also fetches the
 * caller's companies, which the two call sites (layout.tsx, billing/layout.tsx)
 * would otherwise duplicate.
 */

import "server-only";

import { getSession } from "@/lib/auth/session";
import { isCompanyAdmin } from "@/lib/auth/permissions";

export async function hasBillingAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return isCompanyAdmin(session.user.companies, null, session.user.permissions);
}
