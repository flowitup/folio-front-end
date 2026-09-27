/**
 * BillingImportDialog — file → review → import → summary.
 *
 * Covers: the review counts what will be sent and what is left out; each
 * document is sent once with the chosen company; a taken number counts as
 * skipped; an answer that would fail every remaining document stops the run;
 * the list is refreshed only when something was imported.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingImportDialog } from "@/components/billing/billing-import-dialog";
import type { MyCompany } from "@/types/companies";

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  importBillingDocumentAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { importBillingDocumentAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { toast } from "sonner";

const mockImport = vi.mocked(importBillingDocumentAction);

const COMPANY: MyCompany = {
  id: "11111111-2222-3333-4444-555555555555",
  legal_name: "Flowitup SAS",
  address: "1 rue de Paris",
  siret: null,
  tva_number: null,
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: null,
  prefix_override: null,
  created_by: "u-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
  role: "admin",
};

const HEADER = "document_number;status;recipient_name;description;quantity;unit_price;vat_rate";

function csvFile(...rows: string[]): File {
  return new File([[HEADER, ...rows].join("\n")], "history.csv", { type: "text/csv" });
}

function renderDialog(onImported = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingImportDialog
        kind="facture"
        open
        onOpenChange={vi.fn()}
        companies={[COMPANY]}
        onImported={onImported}
      />
    </NextIntlClientProvider>
  );
  return { onImported };
}

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a CSV or JSON file, or drop it here"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe("BillingImportDialog", () => {
  it("imports each document with the company, counts taken numbers as skipped, refreshes the list", async () => {
    mockImport
      .mockResolvedValueOnce({ ok: true, data: { id: "doc-1" } as never })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "document_already_exists", message: "exists" },
      });
    const { onImported } = renderDialog();

    pickFile(
      csvFile(
        "FAC-001;paid;Dupont;Pose;1;100;20",
        "FAC-002;paid;Martin;Peinture;2;50;20",
        "FAC-003;paid;;Sans client;1;10;20"
      )
    );

    expect(await screen.findByText("2 documents ready to import")).toBeDefined();
    expect(screen.getByText("1 document will be left out:")).toBeDefined();
    expect(screen.getByText("FAC-003 — Recipient name missing")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Import 2 documents" }));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(mockImport).toHaveBeenCalledTimes(2);
    expect(mockImport.mock.calls[0][0]).toMatchObject({
      company_id: COMPANY.id,
      kind: "facture",
      document_number: "FAC-001",
      status: "paid",
    });

    const summary = screen.getByTestId("billing-import-summary");
    expect(summary.textContent).toContain("Imported1");
    expect(summary.textContent).toContain("Already in Folio1");
    expect(summary.textContent).toContain("Errors1");
    expect(summary.textContent).toContain("FAC-002");
    expect(onImported).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("1 document imported");
  });

  it("stops at an answer that would fail every remaining document", async () => {
    mockImport.mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden", message: "Forbidden" },
    });
    const { onImported } = renderDialog();

    pickFile(
      csvFile(
        "FAC-001;paid;A;X;1;1;20",
        "FAC-002;paid;B;X;1;1;20",
        "FAC-003;paid;C;X;1;1;20"
      )
    );
    fireEvent.click(await screen.findByRole("button", { name: "Import 3 documents" }));

    expect(await screen.findByText("Import stopped")).toBeDefined();
    expect(mockImport).toHaveBeenCalledOnce();
    expect(screen.getByText("2 documents were not processed.")).toBeDefined();
    expect(screen.getAllByText(/You are not allowed to import for this company/).length).toBeGreaterThan(0);
    expect(onImported).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("No document could be imported.");
  });

  it("explains an unusable file and keeps the import button disabled", async () => {
    renderDialog();

    pickFile(new File(["number,client\nA,B"], "wrong.csv", { type: "text/csv" }));

    expect(
      await screen.findByText(
        "Missing columns: document_number, recipient_name, description, quantity, unit_price, vat_rate."
      )
    ).toBeDefined();
    const start = screen.getByRole("button", { name: "Import" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(mockImport).not.toHaveBeenCalled();
  });

  it("refuses a file larger than the limit without reading it", async () => {
    renderDialog();
    const big = new File(["x"], "big.csv", { type: "text/csv" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });

    pickFile(big);

    expect(await screen.findByText("This file is larger than 10 MB.")).toBeDefined();
  });
});
