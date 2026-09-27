/**
 * Library purchase import file parsing.
 *
 * POST /bibliotheque/import takes the purchase lines of one supplier (the
 * JSON produced by the supplier export used on mobile and by the Folio
 * plugin): `{ supplier_name, supplier_slug, records: [...] }`. A file may hold
 * one such object or an array of them (one per supplier).
 *
 * The API validates a whole request at once, so one malformed line would
 * reject every other line sent with it. Lines the API would refuse are
 * therefore set aside here and reported, and the rest are split into requests
 * of at most 1000 lines (the API maximum).
 */

import {
  cleanText,
  isIsoDateTime,
  normalizeDecimal,
} from "@/lib/import/normalize";
import type { ImportPurchaseRecord, ImportPurchasesPayload } from "@/lib/api/bibliotheque";

export const MAX_RECORDS_PER_REQUEST = 1000;

const OPTIONAL_LIMITS = { size: 200, category: 200, product_url: 500, description: 1000 } as const;

export type LibraryImportIssueCode = "invalidSupplier" | "noRecords" | "invalidRecord";

export interface LibraryImportIssue {
  code: LibraryImportIssueCode;
  /** Supplier name when readable, otherwise the 1-based position of the supplier block. */
  supplier: string;
  /** 1-based position of the line within its supplier block (invalidRecord only). */
  position?: number;
  /** Lines this issue keeps out of the import. */
  lines: number;
}

export type LibraryImportParseResult =
  | {
      ok: true;
      /** Requests to send, already split to the API maximum. */
      batches: ImportPurchasesPayload[];
      suppliers: string[];
      /** Valid lines that will be sent. */
      recordCount: number;
      /** Lines set aside before sending. */
      rejectedCount: number;
      issues: LibraryImportIssue[];
    }
  | { ok: false; error: "unreadable" | "empty" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Curly quotes and non-breaking spaces slip in when the export is copied
 * through a mail client; they make an otherwise valid file unparseable.
 */
function normalizeJsonPunctuation(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[   ]/g, " ");
}

function limited(value: unknown, max: number): string | null | false {
  const text = cleanText(value);
  if (text === null) return null;
  return text.length <= max ? text : false;
}

function toRecord(value: unknown): ImportPurchaseRecord | null {
  if (!isRecord(value)) return null;
  const supplierReference = limited(value.supplier_reference, 200);
  const productName = limited(value.product_name, 1000);
  const sourceRef = limited(value.source_document_ref, 255);
  const quantity = normalizeDecimal(value.quantity);
  const unitPrice = normalizeDecimal(value.unit_price);
  const type = cleanText(value.source_document_type)?.toLowerCase();
  const lineIndex = typeof value.line_index === "string" ? Number(value.line_index) : value.line_index;
  if (!supplierReference || !productName || !sourceRef) return null;
  if (quantity === null || Number(quantity) <= 0) return null;
  if (unitPrice === null || Number(unitPrice) < 0) return null;
  if (!isIsoDateTime(value.purchased_at)) return null;
  if (type !== "ticket" && type !== "commande") return null;
  if (typeof lineIndex !== "number" || !Number.isInteger(lineIndex) || lineIndex < 0) return null;

  const record: ImportPurchaseRecord = {
    supplier_reference: supplierReference,
    product_name: productName,
    quantity,
    unit_price: unitPrice,
    purchased_at: value.purchased_at.trim(),
    source_document_ref: sourceRef,
    source_document_type: type,
    line_index: lineIndex,
  };
  for (const [field, max] of Object.entries(OPTIONAL_LIMITS) as [keyof typeof OPTIONAL_LIMITS, number][]) {
    const optional = limited(value[field], max);
    if (optional === false) return null;
    if (optional) record[field] = optional;
  }
  return record;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function parseLibraryImportFile(text: string): LibraryImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonPunctuation(text));
  } catch {
    return { ok: false, error: "unreadable" };
  }
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  if (blocks.length === 0) return { ok: false, error: "empty" };
  if (!blocks.every(isRecord)) return { ok: false, error: "unreadable" };

  const batches: ImportPurchasesPayload[] = [];
  const suppliers: string[] = [];
  const issues: LibraryImportIssue[] = [];
  let recordCount = 0;
  let rejectedCount = 0;

  blocks.forEach((block, blockIndex) => {
    const rawRecords = Array.isArray(block.records) ? block.records : [];
    const supplierName = limited(block.supplier_name, 255);
    const supplierSlug = limited(block.supplier_slug, 100);
    const website = limited(block.supplier_website_url, 500);
    const urlTemplate = limited(block.supplier_product_url_template, 500);
    const label = supplierName || cleanText(block.supplier_name) || `#${blockIndex + 1}`;

    if (!supplierName || !supplierSlug || website === false || urlTemplate === false) {
      issues.push({ code: "invalidSupplier", supplier: label, lines: rawRecords.length });
      rejectedCount += rawRecords.length;
      return;
    }
    if (rawRecords.length === 0) {
      issues.push({ code: "noRecords", supplier: label, lines: 0 });
      return;
    }

    const records: ImportPurchaseRecord[] = [];
    rawRecords.forEach((raw, i) => {
      const record = toRecord(raw);
      if (record) records.push(record);
      else issues.push({ code: "invalidRecord", supplier: label, position: i + 1, lines: 1 });
    });
    rejectedCount += rawRecords.length - records.length;
    if (records.length === 0) return;

    suppliers.push(supplierName);
    recordCount += records.length;
    for (const part of chunk(records, MAX_RECORDS_PER_REQUEST)) {
      batches.push({
        supplier_name: supplierName,
        supplier_slug: supplierSlug,
        ...(website ? { supplier_website_url: website } : {}),
        ...(urlTemplate ? { supplier_product_url_template: urlTemplate } : {}),
        records: part,
      });
    }
  });

  if (batches.length === 0 && issues.length === 0) return { ok: false, error: "empty" };
  return { ok: true, batches, suppliers, recordCount, rejectedCount, issues };
}
