/**
 * Billing import file parsing: CSV grouping, JSON shapes, and the documents
 * set aside before sending because the API would refuse them.
 */

import { describe, it, expect } from "vitest";
import {
  buildBillingImportTemplate,
  parseBillingImportFile,
  REQUIRED_CSV_COLUMNS,
} from "@/lib/billing/billing-import";

const HEADER =
  "document_number;status;issue_date;recipient_name;notes;description;quantity;unit_price;vat_rate;category";

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

describe("parseBillingImportFile — CSV", () => {
  it("groups line-item rows by document number and normalises French cells", () => {
    const result = parseBillingImportFile(
      csv(
        "FAC-2024-001;paid;14/03/2024;Dupont SARL;Chantier A;Pose carrelage;12,5;45,00;20;Sols",
        "FAC-2024-001;;;;;Plinthes;30;8,5;20;",
        "FAC-2024-002;;2024-04-02;Martin;;Peinture;1;1 200,00 €;10;"
      ),
      "export.csv",
      "facture",
      "sent"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toEqual([]);
    expect(result.documents).toEqual([
      {
        kind: "facture",
        document_number: "FAC-2024-001",
        status: "paid",
        recipient_name: "Dupont SARL",
        notes: "Chantier A",
        issue_date: "2024-03-14",
        items: [
          { description: "Pose carrelage", quantity: "12.5", unit_price: "45.00", vat_rate: "20", category: "Sols" },
          { description: "Plinthes", quantity: "30", unit_price: "8.5", vat_rate: "20" },
        ],
      },
      {
        kind: "facture",
        document_number: "FAC-2024-002",
        // No status column value → the dialog's fallback.
        status: "sent",
        recipient_name: "Martin",
        issue_date: "2024-04-02",
        items: [{ description: "Peinture", quantity: "1", unit_price: "1200.00", vat_rate: "10" }],
      },
    ]);
  });

  it("reports the missing required columns instead of guessing", () => {
    const result = parseBillingImportFile(
      "document_number,recipient_name,description\nA,B,C",
      "x.csv",
      "facture",
      "paid"
    );
    expect(result).toEqual({
      ok: false,
      error: "missingColumns",
      columns: ["quantity", "unit_price", "vat_rate"],
    });
  });

  it("sets aside rows without a number and documents the API would refuse", () => {
    const result = parseBillingImportFile(
      csv(
        ";paid;;Orphan;;Item;1;1;20;",
        "FAC-1;overdue;;Client;;Item;1;1;20;",
        "FAC-2;paid;32/01/2024;Client;;Item;1;1;20;",
        "FAC-3;paid;;;;Item;1;1;20;",
        "FAC-4;paid;;Client;;Item;0;1;20;",
        "FAC-5;paid;;Client;;Item;1;1;20;"
      ),
      "x.csv",
      "facture",
      "paid"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.documents.map((d) => d.document_number)).toEqual(["FAC-5"]);
    expect(result.issues).toEqual([
      { ref: { type: "line", value: 2 }, code: "missingNumber" },
      { ref: { type: "number", value: "FAC-1" }, code: "invalidStatus", params: { value: "overdue" } },
      { ref: { type: "number", value: "FAC-2" }, code: "invalidDate", params: { field: "issue_date" } },
      { ref: { type: "number", value: "FAC-3" }, code: "missingRecipient" },
      { ref: { type: "number", value: "FAC-4" }, code: "invalidItemLine", params: { line: 6 } },
    ]);
  });

  it("only offers draft and sent for quotes", () => {
    const result = parseBillingImportFile(
      csv("DEV-1;paid;;Client;;Item;1;1;20;", "DEV-2;;;Client;;Item;1;1;20;"),
      "x.csv",
      "devis",
      "sent"
    );
    expect(result.ok && result.issues[0]).toMatchObject({ code: "invalidStatus" });
    expect(result.ok && result.documents.map((d) => [d.document_number, d.status])).toEqual([
      ["DEV-2", "sent"],
    ]);
  });
});

describe("parseBillingImportFile — JSON", () => {
  const doc = {
    id: "ignored-export-id",
    kind: "facture",
    document_number: "FAC-9",
    status: "paid",
    recipient_name: "Client",
    total_ttc: "120.00",
    created_at: "2023-05-01T08:00:00Z",
    project_id: "11111111-2222-3333-4444-555555555555",
    items: [{ description: "Work", quantity: 1, unit_price: 100, vat_rate: 20, total_ht: "100" }],
  };

  it("accepts an array, a documents wrapper, a list response or a single document", () => {
    for (const body of [[doc], { documents: [doc] }, { items: [doc], total: 1 }, doc]) {
      const result = parseBillingImportFile(JSON.stringify(body), "data.json", "facture", "draft");
      expect(result.ok && result.documents).toEqual([
        {
          kind: "facture",
          document_number: "FAC-9",
          status: "paid",
          recipient_name: "Client",
          created_at: "2023-05-01T08:00:00Z",
          project_id: "11111111-2222-3333-4444-555555555555",
          // Export-only fields (id, totals) are dropped: the endpoint rejects unknown keys.
          items: [{ description: "Work", quantity: "1", unit_price: "100", vat_rate: "20" }],
        },
      ]);
    }
  });

  it("refuses a document of the other kind and points at unnumbered ones by position", () => {
    const result = parseBillingImportFile(
      JSON.stringify([{ ...doc, kind: "devis" }, { ...doc, document_number: "" }]),
      "data.json",
      "facture",
      "paid"
    );
    expect(result.ok && result.issues).toEqual([
      { ref: { type: "number", value: "FAC-9" }, code: "wrongKind", params: { value: "devis" } },
      { ref: { type: "position", value: 2 }, code: "missingNumber" },
    ]);
  });

  it("flags an unreadable file and an empty one", () => {
    expect(parseBillingImportFile("{nope", "data.json", "facture", "paid")).toEqual({
      ok: false,
      error: "unreadable",
    });
    expect(parseBillingImportFile("[]", "data.json", "facture", "paid")).toEqual({
      ok: false,
      error: "empty",
    });
  });

  it("detects JSON content in a file without extension", () => {
    const result = parseBillingImportFile(JSON.stringify([doc]), "export", "facture", "paid");
    expect(result.ok && result.documents).toHaveLength(1);
  });
});

describe("buildBillingImportTemplate", () => {
  it("lists every required column, with the kind's own date column", () => {
    const facture = buildBillingImportTemplate("facture", ";");
    expect(facture.startsWith("﻿")).toBe(true);
    const columns = facture.slice(1).trim().split(";");
    for (const required of REQUIRED_CSV_COLUMNS) expect(columns).toContain(required);
    expect(columns).toContain("payment_due_date");
    expect(buildBillingImportTemplate("devis", ",")).toContain("validity_until");
  });

  it("round-trips through the parser", () => {
    const template = buildBillingImportTemplate("devis", ";");
    const withRow = `${template}DEV-7;sent;2024-01-10;;Client;;;;;Item;2;50;20;`;
    const result = parseBillingImportFile(withRow, "t.csv", "devis", "sent");
    expect(result.ok && result.documents.map((d) => d.document_number)).toEqual(["DEV-7"]);
  });
});
