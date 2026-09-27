/**
 * LibraryImportDialog — supplier JSON export → review → import → summary.
 *
 * Covers: invalid lines are left out and counted as errors; the valid ones are
 * sent for the page's company; the summary shows the API counts; the library
 * is refreshed only when something changed; a refused batch counts its lines
 * as errors; a non-JSON file is explained.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { LibraryImportDialog } from "@/components/bibliotheque/library-import-dialog";

vi.mock("@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions", () => ({
  importPurchasesAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { importPurchasesAction } from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { toast } from "sonner";

const mockImport = vi.mocked(importPurchasesAction);

function record(i: number, overrides: Record<string, unknown> = {}) {
  return {
    supplier_reference: `REF-${i}`,
    product_name: `Vis ${i}`,
    quantity: 1,
    unit_price: 2.5,
    purchased_at: "2025-06-01T10:00:00",
    source_document_ref: "T-1",
    source_document_type: "ticket",
    line_index: i,
    ...overrides,
  };
}

function jsonFile(body: unknown): File {
  return new File([JSON.stringify(body)], "achats.json", { type: "application/json" });
}

const EXPORT = {
  supplier_name: "Leroy Merlin",
  supplier_slug: "leroy-merlin",
  records: [record(0), record(1), record(2, { quantity: -1 })],
};

function renderDialog(onImported = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LibraryImportDialog open onOpenChange={vi.fn()} companyId="co-1" onImported={onImported} />
    </NextIntlClientProvider>
  );
  return { onImported };
}

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a JSON file, or drop it here"), {
    target: { files: [file] },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("LibraryImportDialog", () => {
  it("sends the valid lines for the company and shows the import counts", async () => {
    mockImport.mockResolvedValueOnce({
      ok: true,
      data: { created: 1, updated: 1, purchases_added: 2, skipped: 0 },
    });
    const { onImported } = renderDialog();

    pickFile(jsonFile(EXPORT));

    expect(await screen.findByText("2 purchase lines from Leroy Merlin")).toBeDefined();
    expect(screen.getByText("1 line will be left out:")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Import 2 lines" }));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(mockImport).toHaveBeenCalledOnce();
    const [companyId, batch] = mockImport.mock.calls[0];
    expect(companyId).toBe("co-1");
    expect(batch.records.map((r) => r.supplier_reference)).toEqual(["REF-0", "REF-1"]);

    const summary = screen.getByTestId("library-import-summary");
    expect(summary.textContent).toContain("Products created1");
    expect(summary.textContent).toContain("Purchases added2");
    expect(summary.textContent).toContain("Lines in error1");
    expect(summary.textContent).toContain("Leroy Merlin, line 3: a required field is missing or invalid");
    expect(onImported).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("2 purchases added to the library");
  });

  it("counts a refused batch as errors and does not refresh", async () => {
    mockImport.mockResolvedValueOnce({ ok: false, error: "records: bad", code: "validation" });
    const { onImported } = renderDialog();

    pickFile(jsonFile({ ...EXPORT, records: [record(0)] }));
    fireEvent.click(await screen.findByRole("button", { name: "Import 1 line" }));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(
      screen.getByText("Leroy Merlin: 1 line not imported. Refused by the server (records: bad)")
    ).toBeDefined();
    expect(onImported).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("No purchase line could be imported.");
  });

  it("stops when the permission is missing", async () => {
    mockImport.mockResolvedValueOnce({ ok: false, error: "Forbidden", code: "forbidden" });
    renderDialog();

    pickFile(jsonFile([EXPORT, { ...EXPORT, supplier_name: "Brico", supplier_slug: "brico" }]));
    fireEvent.click(await screen.findByRole("button", { name: "Import 4 lines" }));

    expect(await screen.findByText("Import stopped")).toBeDefined();
    expect(mockImport).toHaveBeenCalledOnce();
    expect(screen.getByText("2 lines were not processed.")).toBeDefined();
  });

  it("explains a file that is not JSON", async () => {
    renderDialog();

    pickFile(new File(["ref;name"], "achats.csv", { type: "text/csv" }));

    expect(await screen.findByText("This file is not valid JSON.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
