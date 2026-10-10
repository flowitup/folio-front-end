/**
 * BillingDocumentForm — dates and payment terms of a new document.
 *
 *   - billing-25: a new document's validity / due date follows its issue date (+30 days)
 *     until the user picks one, and a date before the issue date is flagged on the field
 *     and blocks Create with a message that names it.
 *   - billing-26: a new facture shows the issuing company's default payment terms (the
 *     ones the API would apply to an empty field), and clearing them creates a facture
 *     without terms instead of silently re-applying the default.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  createBillingDocumentAction: vi.fn(),
  updateBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
  getActivitySuggestionsAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { categories: [], suggestions: [] },
  }),
}));

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchMyCompaniesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj);
  }
  const makeT = (ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      let val = resolve(en, `${ns}.${key}`);
      if (typeof val !== "string") return key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (typeof v !== "function") val = (val as string).replace(`{${k}}`, String(v));
        });
      }
      return val as string;
    };
    t.rich = (key: string, params?: Record<string, unknown>) => t(key, params).replace(/<\/?\w+>/g, "");
    return t;
  };
  return { useLocale: () => "en", useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import { createBillingDocumentAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockCreate = vi.mocked(createBillingDocumentAction);

function company(overrides: Partial<MyCompany> = {}): MyCompany {
  return {
    id: "co-1",
    legal_name: "Maison Lavandou SAS",
    address: "12 Rue de la Paix, 75001 Paris",
    siret: "12345678900012",
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: "Paiement à 30 jours fin de mois",
    prefix_override: null,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
    ...overrides,
  };
}

function makeDoc(overrides: Partial<BillingDocument> = {}): BillingDocument {
  return {
    id: "doc-1",
    user_id: "user-1",
    project_id: null,
    kind: "devis",
    document_number: "DEV-2026-001",
    status: "draft",
    issue_date: "2026-01-15",
    validity_until: "2026-02-14",
    payment_due_date: null,
    payment_terms: null,
    recipient_name: "ACME Corp",
    recipient_address: null,
    recipient_email: null,
    recipient_siret: null,
    notes: null,
    terms: null,
    signature_block_text: null,
    items: [{ description: "Peinture", quantity: "1", unit_price: "100", vat_rate: "20" }],
    issuer_legal_name: "Maison Lavandou SAS",
    issuer_address: "Paris",
    issuer_siret: null,
    issuer_tva_number: null,
    issuer_iban: null,
    issuer_bic: null,
    issuer_logo_url: null,
    source_devis_id: null,
    total_ht: "100",
    total_tva: "20",
    total_ttc: "120",
    vat_breakdown: [{ rate: "20", base_ht: "100", tva_amount: "20" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
const setDate = (id: string, date: string) =>
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value: date } });

async function clickCreate() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("billing-25: validity and due dates follow the issue date", () => {
  it("moves a new devis's validity date with its issue date until the user picks one", () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={[company()]} />);
    setDate("issue-date", "2026-12-15");
    expect(value("validity-until")).toBe("2027-01-14");
    expect((document.getElementById("validity-until") as HTMLInputElement).min).toBe("2026-12-15");

    setDate("validity-until", "2027-03-01");
    setDate("issue-date", "2026-12-20");
    expect(value("validity-until")).toBe("2027-03-01");
  });

  it("moves a new facture's due date with its issue date", () => {
    render(<BillingDocumentForm mode="create" kind="facture" attachedCompanies={[company()]} />);
    setDate("issue-date", "2026-12-15");
    expect(value("payment-due")).toBe("2027-01-14");
  });

  it("keeps an edited document's saved dates when its issue date changes", () => {
    render(
      <BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={[company()]} />
    );
    setDate("issue-date", "2026-01-20");
    expect(value("validity-until")).toBe("2026-02-14");
  });

  it("flags a validity date before the issue date on the field and blocks Create", async () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={[company()]}
        initialFromSource={makeDoc()}
      />
    );
    setDate("validity-until", "2026-01-01");
    setDate("issue-date", "2026-12-15");

    const field = document.getElementById("validity-until") as HTMLInputElement;
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe("validity-until-error");
    expect(document.getElementById("validity-until-error")?.textContent).toBe(
      "The validity date cannot be before the issue date."
    );

    await clickCreate();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getAllByText("The validity date cannot be before the issue date.")).toHaveLength(2);
  });

  it("flags a due date before the issue date and blocks Create", async () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="facture"
        attachedCompanies={[company()]}
        initialFromSource={makeDoc({ kind: "facture", validity_until: null })}
      />
    );
    setDate("payment-due", "2026-01-01");
    setDate("issue-date", "2026-12-15");
    expect(document.getElementById("payment-due")?.getAttribute("aria-invalid")).toBe("true");

    await clickCreate();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getAllByText("The payment due date cannot be before the issue date.")).toHaveLength(2);
  });
});

describe("billing-26: a new facture shows the company's default payment terms", () => {
  it("pre-fills the terms field with the issuing company's default", async () => {
    render(<BillingDocumentForm mode="create" kind="facture" attachedCompanies={[company()]} />);
    await waitFor(() => expect(value("payment-terms")).toBe("Paiement à 30 jours fin de mois"));
  });

  it("uses the default of the company the picker selects", async () => {
    const companies = [
      company({ id: "co-2", legal_name: "Autre SARL", is_primary: false, default_payment_terms: "Comptant" }),
      company(),
    ];
    render(<BillingDocumentForm mode="create" kind="facture" attachedCompanies={companies} />);
    await waitFor(() => expect(value("payment-terms")).toBe("Paiement à 30 jours fin de mois"));
  });

  it("keeps a source document's own terms", async () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="facture"
        attachedCompanies={[company()]}
        initialFromSource={makeDoc({ kind: "facture", payment_terms: "Virement à réception" })}
      />
    );
    await waitFor(() => expect(value("payment-terms")).toBe("Virement à réception"));
  });

  it("sends the shown default, and an empty string once the user clears it", async () => {
    mockCreate.mockResolvedValue({ ok: true, data: makeDoc({ kind: "facture" }) });
    const source = makeDoc({ kind: "facture", validity_until: null });
    const { unmount } = render(
      <BillingDocumentForm mode="create" kind="facture" attachedCompanies={[company()]} initialFromSource={source} />
    );
    await waitFor(() => expect(value("payment-terms")).toBe("Paiement à 30 jours fin de mois"));
    await clickCreate();
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][0].payment_terms).toBe("Paiement à 30 jours fin de mois");
    unmount();

    render(
      <BillingDocumentForm mode="create" kind="facture" attachedCompanies={[company()]} initialFromSource={source} />
    );
    await waitFor(() => expect(value("payment-terms")).toBe("Paiement à 30 jours fin de mois"));
    fireEvent.change(document.getElementById("payment-terms") as HTMLInputElement, { target: { value: "" } });
    await clickCreate();
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[1][0].payment_terms).toBe("");
  });

  it("leaves the field empty for a company without default terms", async () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="facture"
        attachedCompanies={[company({ default_payment_terms: null })]}
      />
    );
    await act(async () => {});
    expect(value("payment-terms")).toBe("");
  });
});
