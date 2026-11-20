/**
 * BillingDocumentForm — B3: a facture whose notes / terms still read like the
 * quote's validity clause gets a non-blocking warning; a new document opened
 * from a project's billing tab (?project_id=) starts on that project, while
 * one opened from the menu only suggests the sidebar project.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument } from "@/types/billing";
import type { MyCompany } from "@/types/companies";
import type { ProjectSummary } from "@/lib/api/projects-server";

let sidebarProjectId: string | null = null;
vi.mock("@/context/ProjectContext", () => ({
  useOptionalProject: () => ({ selectedProjectId: sidebarProjectId }),
}));

vi.mock(
  "@/app/[locale]/(app)/billing/_actions/billing-actions",
  () => ({
    createBillingDocumentAction: vi.fn(),
    updateBillingDocumentAction: vi.fn(),
    deleteBillingDocumentAction: vi.fn(),
    convertDevisToFactureAction: vi.fn(),
    updateBillingDocumentStatusAction: vi.fn(),
  })
);

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    fetchMyCompaniesAction: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/billing/devis",
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      let val = resolve(en, `${ns}.${key}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (typeof v !== "function") val = val?.replace(`{${k}}`, String(v)) ?? val;
        });
      }
      return val ?? key;
    };
    // Rich messages render as plain text here: tags are stripped, values interpolated.
    t.rich = (key: string, params?: Record<string, unknown>) =>
      t(key, params).replace(/<\/?\w+>/g, "");
    return t;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  },
}));

// Stub the billing document items editor to avoid deep component rendering
vi.mock("@/components/billing/billing-document-items-editor", () => ({
  BillingDocumentItemsEditor: ({ items, onChange }: {
    items: unknown[];
    onChange: (items: unknown[]) => void;
  }) => (
    <div data-testid="items-editor">
      <button
        type="button"
        onClick={() =>
          onChange([
            { description: "Test item", quantity: "1", unit_price: "100", vat_rate: "20" },
          ])
        }
      >
        Add test item
      </button>
      <span data-testid="items-count">{items.length}</span>
    </div>
  ),
}));

const COMPANY: MyCompany = {
  id: "company-1",
  legal_name: "ACME Corp",
  siret: null,
  address: "",
  tva_number: null,
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: null,
  prefix_override: null,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
};

const PROJECT_A: ProjectSummary = { id: "proj-a", name: "Project Alpha" };
const PROJECT_B: ProjectSummary = { id: "proj-b", name: "Project Beta" };

const BASE_DOCUMENT: BillingDocument = {
  id: "doc-1",
  user_id: "user-1",
  project_id: "proj-a",
  kind: "devis",
  document_number: "TST-D-2026-0001",
  status: "draft",
  issue_date: "2026-06-01",
  validity_until: "2026-07-01",
  payment_due_date: null,
  payment_terms: null,
  recipient_name: "Test Client",
  recipient_address: null,
  recipient_email: null,
  recipient_siret: null,
  notes: null,
  terms: null,
  signature_block_text: null,
  items: [{ description: "Item A", quantity: "1", unit_price: "100", vat_rate: "20" }],
  issuer_legal_name: "ACME Corp",
  issuer_address: "123 Rue Test",
  issuer_siret: null,
  issuer_tva_number: null,
  issuer_iban: null,
  issuer_bic: null,
  issuer_logo_url: null,
  source_devis_id: null,
  total_ht: "100",
  total_tva: "20",
  total_ttc: "120",
  vat_breakdown: [],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};


const PROJECT_C: ProjectSummary = { id: "proj-c", name: "Shopping Mall", company_id: "company-2" };
const COMPANY_2: MyCompany = { ...COMPANY, id: "company-2", legal_name: "Other SARL", is_primary: false };

const facture = (over: Partial<BillingDocument>): BillingDocument => ({
  ...BASE_DOCUMENT,
  kind: "facture",
  document_number: "FAC-2026-001",
  source_devis_id: "dev-1",
  ...over,
});

describe("BillingDocumentForm — terms copied from the quote", () => {
  beforeEach(() => {
    sidebarProjectId = null;
  });

  it("warns under the terms of a facture that says 'Devis valable 30 jours'", () => {
    render(
      <BillingDocumentForm
        mode="edit"
        kind="facture"
        document={facture({ terms: "Acompte de 30%. Devis valable 30 jours." })}
        attachedCompanies={[COMPANY]}
        projects={[]}
      />
    );
    expect(screen.getAllByTestId("devis-terms-warning")).toHaveLength(1);
    expect(screen.getByText(/looks copied from the quote/)).toBeDefined();
  });

  it("clears the warning once the text is fixed, and never warns on a devis", () => {
    render(
      <BillingDocumentForm
        mode="edit"
        kind="facture"
        document={facture({ notes: "Validité du devis : 1 mois" })}
        attachedCompanies={[COMPANY]}
        projects={[]}
      />
    );
    expect(screen.getAllByTestId("devis-terms-warning")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Merci" } });
    expect(screen.queryByTestId("devis-terms-warning")).toBeNull();
  });

  it("does not warn on a devis", () => {
    render(
      <BillingDocumentForm
        mode="edit"
        kind="devis"
        document={{ ...BASE_DOCUMENT, terms: "Devis valable 30 jours" }}
        attachedCompanies={[COMPANY]}
        projects={[]}
      />
    );
    expect(screen.queryByTestId("devis-terms-warning")).toBeNull();
  });
});

describe("BillingDocumentForm — project of a new document", () => {
  beforeEach(() => {
    sidebarProjectId = null;
  });

  it("starts on the ?project_id= project and its company", () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={[COMPANY, COMPANY_2]}
        projects={[PROJECT_A, PROJECT_C]}
        initialProjectId="proj-c"
      />
    );
    expect(screen.getByText("Shopping Mall")).toBeDefined();
    expect(screen.getByText("Other SARL")).toBeDefined();
    expect(screen.queryByTestId("project-suggestion")).toBeNull();
  });

  it("opened from the menu, links no project but suggests the sidebar one in one tap", () => {
    sidebarProjectId = "proj-b";
    render(
      <BillingDocumentForm
        mode="create"
        kind="facture"
        attachedCompanies={[COMPANY]}
        projects={[PROJECT_A, PROJECT_B]}
      />
    );
    expect(screen.getByText("No project")).toBeDefined();
    const suggestion = screen.getByTestId("project-suggestion");
    expect(suggestion.textContent).toBe("Link to Project Beta?");
    fireEvent.click(suggestion);
    expect(screen.queryByText("No project")).toBeNull();
    expect(screen.getByText("Project Beta")).toBeDefined();
    expect(screen.queryByTestId("project-suggestion")).toBeNull();
  });

  it("ignores a ?project_id= the user cannot link", () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={[COMPANY]}
        projects={[PROJECT_A]}
        initialProjectId="proj-zzz"
      />
    );
    expect(screen.getByText("No project")).toBeDefined();
  });
});
