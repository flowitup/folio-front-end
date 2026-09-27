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
 * of at most 1000 lines (the API maximum) that also stay under the size a
 * server action accepts (see payload-size.ts): a line with a long name,
 * description and product URL weighs well over 1 KB.
 */

import {
  cleanText,
  isIsoDateTime,
  normalizeDecimal,
} from "@/lib/import/normalize";
import { MAX_ACTION_PAYLOAD_BYTES, jsonByteLength } from "@/lib/import/payload-size";
import type { ImportPurchaseRecord, ImportPurchasesPayload } from "@/lib/api/bibliotheque";

export const MAX_RECORDS_PER_REQUEST = 1000;

/** Room kept in each request for the company id and the JSON punctuation around the records. */
const REQUEST_ENVELOPE_BYTES = 128;

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
      /** Distinct supplier names, in file order. */
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
 * Only applied when the file does not parse as it is, because the same
 * characters are legitimate inside values (a product named “PER”).
 */
function normalizeJsonPunctuation(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u00A0\u2007\u202F]/g, " ");
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const bare = text.replace(/^\uFEFF/, "");
  for (const candidate of [bare, normalizeJsonPunctuation(bare)]) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      // Try the next reading.
    }
  }
  return { ok: false };
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

/**
 * Split one supplier's lines into requests of at most 1000 lines whose
 * serialized size stays under the server-action budget.
 */
function splitIntoRequests(
  supplier: Omit<ImportPurchasesPayload, "records">,
  records: ImportPurchaseRecord[]
): ImportPurchasesPayload[] {
  const envelope = jsonByteLength(supplier) + REQUEST_ENVELOPE_BYTES;
  const requests: ImportPurchasesPayload[] = [];
  let current: ImportPurchaseRecord[] = [];
  let bytes = envelope;
  for (const record of records) {
    const size = jsonByteLength(record) + 1; // + the separating comma
    const full =
      current.length >= MAX_RECORDS_PER_REQUEST || bytes + size > MAX_ACTION_PAYLOAD_BYTES;
    if (current.length > 0 && full) {
      requests.push({ ...supplier, records: current });
      current = [];
      bytes = envelope;
    }
    current.push(record);
    bytes += size;
  }
  if (current.length > 0) requests.push({ ...supplier, records: current });
  return requests;
}

export function parseLibraryImportFile(text: string): LibraryImportParseResult {
  const json = parseJson(text);
  if (!json.ok) return { ok: false, error: "unreadable" };
  const parsed = json.value;
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

    if (!suppliers.includes(supplierName)) suppliers.push(supplierName);
    recordCount += records.length;
    const supplier = {
      supplier_name: supplierName,
      supplier_slug: supplierSlug,
      ...(website ? { supplier_website_url: website } : {}),
      ...(urlTemplate ? { supplier_product_url_template: urlTemplate } : {}),
    };
    batches.push(...splitIntoRequests(supplier, records));
  });

  if (batches.length === 0 && issues.length === 0) return { ok: false, error: "empty" };
  return { ok: true, batches, suppliers, recordCount, rejectedCount, issues };
}
