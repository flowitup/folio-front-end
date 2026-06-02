/**
 * Server-side billing-access gate.
 *
 * Billing is per-company, admin-gated: a user may see/manage billing only if
 * they are a superadmin (global "*:*") OR hold the "admin" role in at least one
 * company they belong to. Used to gate the billing nav group and billing pages.
 */

import "server-only";

import { getSession } from "@/lib/auth/session";
import { fetchMyCompanies } from "@/lib/api/companies/companies";

export async function hasBillingAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.user.permissions.includes("*:*")) return true;
  try {
    const companies = await fetchMyCompanies();
    return companies.some((c) => c.role === "admin");
  } catch {
    // On a transient companies-fetch failure, fail closed (hide billing).
    return false;
  }
}
