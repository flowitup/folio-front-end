/**
 * Companies the caller may issue billing documents for — server-only.
 *
 * Creating a quote or invoice requires the admin role in the issuing company
 * (platform ops may act for any company they are attached to). The import
 * endpoint only checks attachment, so the billing lists offer imports for the
 * same companies creation allows, and hide the action when there is none.
 */

import "server-only";

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { getSession } from "@/lib/auth/session";
import { isPlatformOps } from "@/lib/auth/permissions";
import type { MyCompany } from "@/types/companies";

export async function fetchBillingIssuerCompanies(): Promise<MyCompany[]> {
  try {
    const [companies, session] = await Promise.all([fetchMyCompanies(), getSession()]);
    const platformOps = isPlatformOps(session?.user.permissions);
    return companies.filter((company) => platformOps || company.role === "admin");
  } catch (err) {
    console.warn(
      "[billing] Could not load issuer companies:",
      err instanceof Error ? err.message : "unknown"
    );
    return [];
  }
}
