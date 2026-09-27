/**
 * Library purchase import parsing: accepted shapes, lines set aside before
 * sending, and the split into requests of at most 1000 lines.
 */

import { describe, it, expect } from "vitest";
import {
  MAX_RECORDS_PER_REQUEST,
  parseLibraryImportFile,
} from "@/lib/bibliotheque/library-import";

function record(i: number, overrides: Record<string, unknown> = {}) {
  return {
    supplier_reference: `REF-${i}`,
    product_name: `Product ${i}`,
    quantity: 2,
    unit_price: "12,90",
    purchased_at: "2025-06-01T10:00:00",
    source_document_ref: "T-1",
    source_document_type: "ticket",
    line_index: i,
    ...overrides,
  };
}

const SUPPLIER = {
  supplier_name: "Leroy Merlin",
  supplier_slug: "leroy-merlin",
  supplier_website_url: "https://www.leroymerlin.fr",
};

describe("parseLibraryImportFile", () => {
  it("builds one request per supplier and normalises amounts", () => {
    const result = parseLibraryImportFile(
      JSON.stringify({ ...SUPPLIER, records: [record(0, { size: "2 m", extra: "ignored" })] })
    );
    expect(result).toEqual({
      ok: true,
      suppliers: ["Leroy Merlin"],
      recordCount: 1,
      rejectedCount: 0,
      issues: [],
      batches: [
        {
          supplier_name: "Leroy Merlin",
          supplier_slug: "leroy-merlin",
          supplier_website_url: "https://www.leroymerlin.fr",
          records: [
            {
              supplier_reference: "REF-0",
              product_name: "Product 0",
              quantity: "2",
              unit_price: "12.90",
              purchased_at: "2025-06-01T10:00:00",
              source_document_ref: "T-1",
              source_document_type: "ticket",
              line_index: 0,
              size: "2 m",
            },
          ],
        },
      ],
    });
  });

  it("splits a large export into requests of at most 1000 lines", () => {
    const records = Array.from({ length: 2300 }, (_, i) => record(i));
    const result = parseLibraryImportFile(JSON.stringify({ ...SUPPLIER, records }));
    expect(result.ok && result.batches.map((b) => b.records.length)).toEqual([
      MAX_RECORDS_PER_REQUEST,
      MAX_RECORDS_PER_REQUEST,
      300,
    ]);
    expect(result.ok && result.recordCount).toBe(2300);
  });

  it("sets aside lines the API would refuse so they do not sink the others", () => {
    const result = parseLibraryImportFile(
      JSON.stringify([
        {
          ...SUPPLIER,
          records: [
            record(0),
            record(1, { quantity: 0 }),
            record(2, { source_document_type: "facture" }),
            record(3, { purchased_at: "yesterday" }),
            record(4, { line_index: -1 }),
          ],
        },
        { supplier_name: "", supplier_slug: "x", records: [record(5), record(6)] },
        { supplier_name: "Brico", supplier_slug: "brico", records: [] },
      ])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recordCount).toBe(1);
    expect(result.rejectedCount).toBe(6);
    expect(result.issues).toEqual([
      { code: "invalidRecord", supplier: "Leroy Merlin", position: 2, lines: 1 },
      { code: "invalidRecord", supplier: "Leroy Merlin", position: 3, lines: 1 },
      { code: "invalidRecord", supplier: "Leroy Merlin", position: 4, lines: 1 },
      { code: "invalidRecord", supplier: "Leroy Merlin", position: 5, lines: 1 },
      { code: "invalidSupplier", supplier: "#2", lines: 2 },
      { code: "noRecords", supplier: "Brico", lines: 0 },
    ]);
  });

  it("tolerates curly quotes pasted through a mail client", () => {
    const text = JSON.stringify({ ...SUPPLIER, records: [record(0)] }).replace(/"/g, "“");
    expect(parseLibraryImportFile(text).ok).toBe(true);
  });

  it("rejects text that is not JSON and files with nothing in them", () => {
    expect(parseLibraryImportFile("supplier;name")).toEqual({ ok: false, error: "unreadable" });
    expect(parseLibraryImportFile("[1, 2]")).toEqual({ ok: false, error: "unreadable" });
    expect(parseLibraryImportFile("[]")).toEqual({ ok: false, error: "empty" });
  });
});
