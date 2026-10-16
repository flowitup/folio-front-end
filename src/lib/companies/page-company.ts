/**
 * Which company a company-scoped page (library, inventory) shows.
 *
 * `?company=<id>` wins when it is one of the user's companies; otherwise the
 * primary company, else the oldest attachment — the order GET /companies uses,
 * so the page and an API call without company_id agree. A user attached to two
 * companies by their admins has no primary at all: they still get a stable
 * default and can switch with the picker.
 */

import type { MyCompany } from "@/types/companies";

/** The fields a company picker needs. */
export interface PageCompany {
  id: string;
  legal_name: string;
  is_primary: boolean;
  /** Undefined when the API did not send per-company permissions (older back end). */
  permissions?: string[];
}

export function companiesInApiOrder<T extends Pick<MyCompany, "is_primary" | "attached_at">>(
  companies: readonly T[],
): T[] {
  return [...companies].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return new Date(a.attached_at).getTime() - new Date(b.attached_at).getTime();
  });
}

export function pickPageCompany<T extends Pick<MyCompany, "id" | "is_primary" | "attached_at">>(
  companies: readonly T[],
  requested?: string | string[] | null,
): T | null {
  const wanted = Array.isArray(requested) ? requested[0] : requested;
  const ordered = companiesInApiOrder(companies);
  return (wanted ? ordered.find((c) => c.id === wanted) : undefined) ?? ordered[0] ?? null;
}

export function toPageCompanies(companies: readonly MyCompany[]): PageCompany[] {
  return companiesInApiOrder(companies).map((c) => ({
    id: c.id,
    legal_name: c.legal_name,
    is_primary: c.is_primary,
    ...(c.permissions ? { permissions: c.permissions } : {}),
  }));
}

/**
 * Name of a project's company, shown next to the project only when the user
 * belongs to several companies (otherwise every project is the same company's).
 */
export function projectCompanyLabel(
  companies: readonly { id: string; legal_name: string }[] | null | undefined,
  companyId: string | null | undefined,
): string | null {
  const list = companies ?? [];
  if (list.length < 2 || !companyId) return null;
  return list.find((c) => c.id === companyId)?.legal_name ?? null;
}
