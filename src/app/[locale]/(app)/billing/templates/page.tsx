/**
 * Templates list page — server component.
 *
 * Fetches all billing document templates for the current user, scoped to
 * their default admin company (roles-permissions-redesign: templates are
 * company-scoped), and passes them to BillingTemplatesCompanyScope (client)
 * which adds a company picker when the caller admins more than one.
 *
 * Auth: handled by layout middleware.
 * Error handling: API failures render empty state; component handles gracefully.
 */

import { fetchBillingTemplates } from "@/lib/api/billing/templates";
import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { BillingTemplatesCompanyScope } from "@/components/billing/billing-templates-company-scope";
import type { BillingDocumentTemplate } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

export default async function TemplatesPage() {
  let adminCompanies: MyCompany[] = [];
  try {
    const companies = await fetchMyCompanies();
    adminCompanies = companies.filter((c) => c.role === "admin");
  } catch (err) {
    console.error(
      "[TemplatesPage] Failed to fetch companies:",
      err instanceof Error ? err.message : "unknown"
    );
  }

  const defaultCompanyId = (adminCompanies.find((c) => c.is_primary) ?? adminCompanies[0])?.id ?? null;

  let initialTemplates: BillingDocumentTemplate[] = [];
  try {
    initialTemplates = await fetchBillingTemplates(undefined, defaultCompanyId ?? undefined);
  } catch (err) {
    // Log server-side; render empty state gracefully.
    console.error(
      "[TemplatesPage] Failed to fetch billing templates:",
      err instanceof Error ? err.message : "unknown"
    );
  }

  return (
    <BillingTemplatesCompanyScope
      adminCompanies={adminCompanies}
      initialTemplates={initialTemplates}
      initialCompanyId={defaultCompanyId}
    />
  );
}
