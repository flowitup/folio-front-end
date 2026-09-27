/**
 * Companies the caller may issue billing documents for — server-only.
 *
 * Creating a quote or invoice requires the admin role in the issuing company
 * (assert_company_admin, with no platform-ops bypass). The import endpoint
 * only checks attachment, so the billing lists offer imports for exactly the
 * companies creation allows, and hide the action when there is none. A
 * platform-ops user who is a plain member of a company is not offered it.
 *
 * The decision is taken from the session, which the billing layout's access
 * check has already loaded for this request; the full company records the
 * picker needs are only fetched when there is a company to offer.
 */

import "server-only";

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { getSession } from "@/lib/auth/session";
import type { MyCompany } from "@/types/companies";

export async function fetchBillingIssuerCompanies(): Promise<MyCompany[]> {
  try {
    const session = await getSession();
    const adminOfAny = (session?.user.companies ?? []).some((c) => c.role === "admin");
    if (!adminOfAny) return [];
    const companies = await fetchMyCompanies();
    return companies.filter((company) => company.role === "admin");
  } catch (err) {
    console.warn(
      "[billing] Could not load issuer companies:",
      err instanceof Error ? err.message : "unknown"
    );
    return [];
  }
}
