/**
 * BillingImportDialog — file → review → import → summary.
 *
 * Covers: the review counts what will be sent and what is left out (rows
 * without a number apart from documents); each document is sent once with
 * the chosen company; a taken number counts as skipped; an answer that would
 * fail every remaining document stops the run; a server action that rejects
 * still ends on a summary the user can close; a rate limit pauses with a
 * countdown that Stop ends at once; the list is refreshed only when
 * something was imported.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
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

function renderDialog(onImported = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingImportDialog
        kind="facture"
        open
        onOpenChange={onOpenChange}
        companies={[COMPANY]}
        onImported={onImported}
      />
    </NextIntlClientProvider>
  );
  return { onImported, onOpenChange };
}

function pickFile(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a CSV or JSON file, or drop it here"), {
    target: { files: [file] },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(screen.getByText("1 document will be left out.")).toBeDefined();
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

  it("counts rows without a number apart from the documents left out", async () => {
    mockImport.mockResolvedValue({
      ok: false,
      error: { code: "validation", message: "items: bad" },
    });
    renderDialog();

    pickFile(
      csvFile(
        "FAC-001;paid;Dupont;Pose;1;100;20",
        ";paid;Dupont;Orphan row;1;1;20",
        ";paid;Dupont;Orphan row;1;1;20",
        "FAC-002;paid;;Sans client;1;10;20"
      )
    );

    expect(
      await screen.findByText(
        "1 document will be left out. 2 rows have no document number and are ignored."
      )
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Import 1 document" }));

    const summary = await screen.findByTestId("billing-import-summary");
    // One refused by the server + one left out: documents, not rows.
    expect(summary.textContent).toContain("Errors2");
    expect(summary.textContent).toContain(
      "2 rows have no document number and are ignored."
    );
  });

  it("ends on a summary that can be closed when a server action call rejects", async () => {
    mockImport
      .mockResolvedValueOnce({ ok: true, data: { id: "doc-1" } as never })
      .mockRejectedValueOnce(new Error("Failed to find Server Action"));
    const { onImported, onOpenChange } = renderDialog();

    pickFile(
      csvFile(
        "FAC-001;paid;A;X;1;1;20",
        "FAC-002;paid;B;X;1;1;20",
        "FAC-003;paid;C;X;1;1;20"
      )
    );
    fireEvent.click(await screen.findByRole("button", { name: "Import 3 documents" }));

    expect(await screen.findByText("Import stopped")).toBeDefined();
    expect(mockImport).toHaveBeenCalledTimes(2);
    const summary = screen.getByTestId("billing-import-summary");
    expect(summary.textContent).toContain("Imported1");
    expect(summary.textContent).toContain("Errors1");
    expect(summary.textContent).toContain("FAC-002 — Unexpected error, try again");
    expect(screen.getByText("1 document was not processed.")).toBeDefined();
    expect(onImported).toHaveBeenCalledOnce();

    // Both the corner button and the footer one close it: the run is over.
    for (const close of screen.getAllByRole("button", { name: "Close" })) fireEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pauses on a rate limit with a countdown, and Stop ends the pause at once", async () => {
    mockImport.mockResolvedValue({
      ok: false,
      error: { code: "rate_limited", message: "Too many requests" },
    });
    renderDialog();

    pickFile(csvFile("FAC-001;paid;A;X;1;1;20", "FAC-002;paid;B;X;1;1;20"));
    const start = await screen.findByRole("button", { name: "Import 2 documents" });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(start);

    expect(
      await screen.findByText("The server asked for a pause. Resuming in 20 s…")
    ).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText("The server asked for a pause. Resuming in 19 s…")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    // No waiting for the 20 s pause to run out.
    expect(await screen.findByText("Import stopped")).toBeDefined();
    expect(mockImport).toHaveBeenCalledOnce();
    expect(screen.getByText("2 documents were not processed.")).toBeDefined();
    expect(screen.queryByText(/Resuming in/)).toBeNull();
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
