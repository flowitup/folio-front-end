/**
 * LibraryImportDialog — supplier JSON export → review → import → summary.
 *
 * Covers: invalid lines are left out and counted as errors; the valid ones are
 * sent for the page's company, or the one picked; the summary shows the API
 * counts; the library is refreshed only when something changed; a refused
 * batch counts its lines as errors; a server action that rejects still ends
 * on a summary; a rate limit pauses and retries; a non-JSON file is explained.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const COMPANIES = [
  { id: "co-2", legal_name: "Atelier Nord", is_primary: false },
  { id: "co-1", legal_name: "Flowitup SAS", is_primary: true },
];

function renderDialog(
  onImported = vi.fn(),
  companies: { id: string; legal_name: string; is_primary: boolean }[] = []
) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LibraryImportDialog
        open
        onOpenChange={vi.fn()}
        companyId="co-1"
        companies={companies}
        onImported={onImported}
      />
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
afterEach(() => vi.useRealTimers());

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
    expect(onImported).toHaveBeenCalledWith("co-1");
    expect(toast.success).toHaveBeenCalledWith("2 purchases added to the library");
    // One company: no picker.
    expect(screen.queryByLabelText("Company")).toBeNull();
  });

  it("imports into the company picked by a user of several companies", async () => {
    mockImport.mockResolvedValueOnce({
      ok: true,
      data: { created: 1, updated: 0, purchases_added: 1, skipped: 0 },
    });
    const { onImported } = renderDialog(vi.fn(), COMPANIES);

    // The page's company is the default target.
    expect(screen.getByRole("combobox", { name: "Company" }).textContent).toBe("Flowitup SAS");
    await userEvent.click(screen.getByRole("combobox", { name: "Company" }));
    await userEvent.click(await screen.findByRole("option", { name: "Atelier Nord" }));

    pickFile(jsonFile({ ...EXPORT, records: [record(0)] }));
    fireEvent.click(await screen.findByRole("button", { name: "Import 1 line" }));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(mockImport.mock.calls[0][0]).toBe("co-2");
    expect(onImported).toHaveBeenCalledWith("co-2");
  });

  it("says products were updated when a re-import only enriched them", async () => {
    mockImport.mockResolvedValueOnce({
      ok: true,
      data: { created: 0, updated: 2, purchases_added: 0, skipped: 2 },
    });
    const { onImported } = renderDialog();

    pickFile(jsonFile({ ...EXPORT, records: [record(0), record(1)] }));
    fireEvent.click(await screen.findByRole("button", { name: "Import 2 lines" }));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(toast.success).toHaveBeenCalledWith("2 products updated in the library");
    expect(onImported).toHaveBeenCalledOnce();
  });

  it("ends on a summary when the server action call rejects", async () => {
    mockImport.mockRejectedValueOnce(new Error("Body exceeded 1 MB limit"));
    const { onImported } = renderDialog();

    pickFile(jsonFile([EXPORT, { ...EXPORT, supplier_name: "Brico", supplier_slug: "brico" }]));
    fireEvent.click(await screen.findByRole("button", { name: "Import 4 lines" }));

    expect(await screen.findByText("Import stopped")).toBeDefined();
    expect(mockImport).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        "Leroy Merlin: 2 lines not imported. Unexpected error, try again."
      )
    ).toBeDefined();
    expect(screen.getByText("2 lines were not processed.")).toBeDefined();
    expect(onImported).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("No purchase line could be imported.");
    // The run is over: the footer offers Close again.
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  it("waits out a rate limit, then sends the batch again", async () => {
    mockImport
      .mockResolvedValueOnce({ ok: false, error: "Too many requests", code: "rate_limited" })
      .mockResolvedValueOnce({
        ok: true,
        data: { created: 1, updated: 0, purchases_added: 1, skipped: 0 },
      });
    renderDialog();

    pickFile(jsonFile({ ...EXPORT, records: [record(0)] }));
    const start = await screen.findByRole("button", { name: "Import 1 line" });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(start);
    expect(
      await screen.findByText("The server asked for a pause. Resuming in 20 s…")
    ).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(await screen.findByText("Import finished")).toBeDefined();
    expect(mockImport).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("library-import-summary").textContent).toContain("Purchases added1");
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
