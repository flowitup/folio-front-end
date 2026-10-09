/**
 * New devis / facture pages offer only the companies the caller may issue
 * from (admin role): the API refuses billing in a company where the caller is
 * a member, so offering one there only failed on save with "Forbidden".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/billing/billing-issuer-companies", () => ({
  fetchBillingIssuerCompanies: vi.fn(),
}));
vi.mock("@/lib/api/companies/companies", () => ({
  fetchMyCompanies: vi.fn(),
}));
vi.mock("@/lib/api/projects-server", () => ({ listProjects: vi.fn(async () => []) }));
vi.mock("@/lib/api/billing/documents", () => ({ fetchBillingDocument: vi.fn() }));
vi.mock("@/lib/api/billing/templates", () => ({ fetchBillingTemplate: vi.fn() }));
vi.mock("@/components/billing/billing-document-form", () => ({
  BillingDocumentForm: () => null,
}));
vi.mock("@/components/billing/no-attached-companies-callout", () => ({
  NoAttachedCompaniesCallout: () => null,
}));

import { fetchBillingIssuerCompanies } from "@/lib/billing/billing-issuer-companies";
import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import { NoAttachedCompaniesCallout } from "@/components/billing/no-attached-companies-callout";
import type { MyCompany } from "@/types/companies";
import NewDevisPage from "../devis/new/page";
import NewFacturePage from "../factures/new/page";

const ADMIN_CO = { id: "co-admin", legal_name: "Xco One", role: "admin", is_primary: false } as MyCompany;

const pages = [
  ["devis", NewDevisPage],
  ["facture", NewFacturePage],
] as const;

beforeEach(() => vi.clearAllMocks());

describe.each(pages)("new %s page", (_kind, Page) => {
  it("passes only the issuer companies to the form", async () => {
    vi.mocked(fetchBillingIssuerCompanies).mockResolvedValue([ADMIN_CO]);
    const element = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement<{
      attachedCompanies: MyCompany[];
    }>;
    expect(element.type).toBe(BillingDocumentForm);
    expect(element.props.attachedCompanies).toEqual([ADMIN_CO]);
    expect(fetchMyCompanies).not.toHaveBeenCalled();
  });

  it("shows the callout when the caller administers no company", async () => {
    vi.mocked(fetchBillingIssuerCompanies).mockResolvedValue([]);
    const element = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement;
    expect(element.type).toBe(NoAttachedCompaniesCallout);
  });
});
