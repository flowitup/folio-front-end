/**
 * BillingDocumentList — the Import action is offered only when the caller may
 * issue documents for at least one company, including on the empty list
 * (where importing history is most useful), and opens the kind's dialog.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { MyCompany } from "@/types/companies";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/billing/factures",
}));

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
}));

const COMPANY = {
  id: "11111111-2222-3333-4444-555555555555",
  legal_name: "Flowitup SAS",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
} as MyCompany;

function renderList(issuerCompanies?: MyCompany[]) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingDocumentList
        kind="facture"
        initialDocuments={[]}
        initialTotal={0}
        issuerCompanies={issuerCompanies}
      />
    </NextIntlClientProvider>
  );
}

describe("BillingDocumentList import action", () => {
  it("opens the invoice import dialog from the empty list", () => {
    renderList([COMPANY]);

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Import invoices")).toBeDefined();
    expect(screen.getByText("Choose a CSV or JSON file, or drop it here")).toBeDefined();
  });

  it("is hidden when the caller cannot issue documents for any company", () => {
    renderList([]);
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.getByRole("button", { name: "New invoice" })).toBeDefined();
  });
});
