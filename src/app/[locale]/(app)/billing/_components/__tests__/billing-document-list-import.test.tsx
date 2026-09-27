/**
 * BillingDocumentList — the Import action is offered only when the caller may
 * issue documents for at least one company, including on the empty list
 * (where importing history is most useful), and opens the kind's dialog. The
 * dialog keeps its summary when a first import turns the empty state into
 * the list.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingDocumentList } from "../billing-document-list";
import type { BillingDocument } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/billing/factures",
}));

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));

import { importBillingDocumentAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockImport = vi.mocked(importBillingDocumentAction);

const COMPANY = {
  id: "11111111-2222-3333-4444-555555555555",
  legal_name: "Flowitup SAS",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
} as MyCompany;

function listElement(issuerCompanies?: MyCompany[], documents: BillingDocument[] = []) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingDocumentList
        kind="facture"
        initialDocuments={documents}
        initialTotal={documents.length}
        issuerCompanies={issuerCompanies}
      />
    </NextIntlClientProvider>
  );
}

function renderList(issuerCompanies?: MyCompany[]) {
  return render(listElement(issuerCompanies));
}

const IMPORTED = {
  id: "doc-1",
  kind: "facture",
  document_number: "FAC-001",
  status: "paid",
  recipient_name: "Dupont",
  issue_date: "2024-03-14",
  total_ttc: "120.00",
} as BillingDocument;

beforeEach(() => vi.clearAllMocks());

describe("BillingDocumentList import action", () => {
  it("opens the invoice import dialog from the empty list", () => {
    renderList([COMPANY]);

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Import invoices")).toBeDefined();
    expect(screen.getByText("Choose a CSV or JSON file, or drop it here")).toBeDefined();
  });

  it("keeps the summary when the first import turns the empty state into the list", async () => {
    mockImport.mockResolvedValueOnce({ ok: true, data: IMPORTED });
    const { rerender } = renderList([COMPANY]);

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByLabelText("Choose a CSV or JSON file, or drop it here"), {
      target: {
        files: [
          new File(
            [
              "document_number;recipient_name;description;quantity;unit_price;vat_rate\n" +
                "FAC-001;Dupont;Pose;1;100;20",
            ],
            "history.csv",
            { type: "text/csv" }
          ),
        ],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Import 1 document" }));
    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(mockRefresh).toHaveBeenCalledOnce();

    // The refreshed server page hands the list its first document.
    rerender(listElement([COMPANY], [IMPORTED]));

    expect(screen.getAllByText("FAC-001").length).toBeGreaterThan(0);
    expect(screen.getByTestId("billing-import-summary").textContent).toContain("Imported1");
  });

  it("is hidden when the caller cannot issue documents for any company", () => {
    renderList([]);
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.getByRole("button", { name: "New invoice" })).toBeDefined();
  });
});
