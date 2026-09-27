/**
 * importPurchasesAction — passes the batch through and classifies failures
 * so the import dialog can pause (429), stop (401/403) or count lines as
 * failed (400/422, other errors).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/bibliotheque", () => ({ importPurchases: vi.fn() }));

import { importPurchasesAction } from "../bibliotheque-actions";
import { importPurchases, type ImportPurchasesPayload } from "@/lib/api/bibliotheque";

const mockImport = vi.mocked(importPurchases);

const BATCH: ImportPurchasesPayload = {
  supplier_name: "Leroy Merlin",
  supplier_slug: "leroy-merlin",
  records: [
    {
      supplier_reference: "REF-1",
      product_name: "Vis",
      quantity: "2",
      unit_price: "3.5",
      purchased_at: "2025-06-01",
      source_document_ref: "T-1",
      source_document_type: "ticket",
      line_index: 0,
    },
  ],
};

function httpError(status: number, message?: string) {
  return Object.assign(new Error(`Failed (HTTP ${status})`), {
    status,
    body: message ? { error: "X", message } : null,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("importPurchasesAction", () => {
  it("returns the import counts", async () => {
    const counts = { created: 1, updated: 0, purchases_added: 1, skipped: 0 };
    mockImport.mockResolvedValueOnce(counts);
    expect(await importPurchasesAction("co-1", BATCH)).toEqual({ ok: true, data: counts });
    expect(mockImport).toHaveBeenCalledWith("co-1", BATCH);
  });

  it.each([
    [429, "rate_limited"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [400, "validation"],
    [422, "validation"],
    [500, "generic"],
  ])("maps HTTP %i to %s", async (status, code) => {
    mockImport.mockRejectedValueOnce(httpError(status, "server says"));
    expect(await importPurchasesAction("co-1", BATCH)).toEqual({
      ok: false,
      error: "server says",
      code,
    });
  });

  it("falls back to the error message when the body carries none", async () => {
    mockImport.mockRejectedValueOnce(new Error("Network error importing purchases"));
    expect(await importPurchasesAction("co-1", BATCH)).toEqual({
      ok: false,
      error: "Network error importing purchases",
      code: "generic",
    });
  });
});
