/**
 * BillingDocumentList — users issuing for several companies see each
 * document's issuer, since two companies can both have a FAC-2026-001.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/billing/factures",
}));
vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));

const company = (id: string, legal_name: string) =>
  ({ id, legal_name, is_primary: false, attached_at: "2026-01-01T00:00:00Z", role: "admin" }) as MyCompany;
const doc = (id: string, issuer: string) =>
  ({
    id,
    kind: "facture",
    document_number: "FAC-2026-001",
    status: "draft",
    recipient_name: "Client",
    issue_date: "2026-03-14",
    total_ttc: "120.00",
    issuer_legal_name: issuer,
  }) as BillingDocument;

function renderList(companies: MyCompany[]) {
  const docs = [doc("d1", "Epsilon"), doc("d2", "Zeta")];
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingDocumentList
        kind="facture"
        initialDocuments={docs}
        initialTotal={docs.length}
        issuerCompanies={companies}
      />
    </NextIntlClientProvider>,
  );
}

describe("BillingDocumentList issuer", () => {
  it("shows the issuer of each document to users of several companies", () => {
    renderList([company("a", "Epsilon"), company("b", "Zeta")]);
    expect(screen.getAllByTestId("billing-row-issuer").map((c) => c.textContent)).toEqual([
      "Epsilon",
      "Zeta",
    ]);
    expect(screen.getByText("Issuer")).toBeDefined();
  });

  it("keeps the single-company list as it was", () => {
    renderList([company("a", "Epsilon")]);
    expect(screen.queryByTestId("billing-row-issuer")).toBeNull();
  });
});
