/**
 * Billing import file parsing — historical quotes and invoices.
 *
 * POST /billing-documents/import takes ONE document per request, with its
 * original number and status. This module turns an uploaded file into those
 * request bodies (without company_id, which the dialog picks) and rejects,
 * before anything is sent, the documents the API would refuse anyway.
 *
 * Accepted files:
 *   - JSON: an array of documents, `{ "documents": [...] }`, a list response
 *     (`{ "items": [documents...] }`) or a single document. Field names are the
 *     API's; unknown fields (ids, totals of an export) are dropped because the
 *     endpoint rejects extra keys.
 *   - CSV (`,` `;` or tab separated): one row per line item; rows sharing a
 *     document_number form one document, whose other columns are read from
 *     the first row that fills them.
 *
 * project_id is never sent: the import endpoint does not check the caller's
 * access to the project (creation does), so a file exported from another
 * company could link documents to a project the caller cannot see, and an
 * unknown id fails with a server error. Documents are linked to a project
 * from their own page after the import.
 */

import { parseCsv, toCsvCell } from "@/lib/import/csv";
import {
  cleanText,
  detectDateOrder,
  isAmbiguousDate,
  isIsoDateTime,
  isPlausibleEmail,
  normalizeDecimal,
  normalizeIsoDate,
  type DateOrder,
} from "@/lib/import/normalize";
import { MAX_ACTION_PAYLOAD_BYTES, jsonByteLength } from "@/lib/import/payload-size";
import type {
  BillingDocumentItem,
  BillingDocumentKind,
  ImportBillingDocumentPayload,
  ImportBillingDocumentStatus,
} from "@/types/billing";

// ---------------------------------------------------------------------------
// Rules mirrored from the API schema (ImportBillingDocumentRequest / ItemSchema)
// ---------------------------------------------------------------------------

/**
 * Statuses offered per list. The API accepts draft/sent/paid/cancelled for
 * both kinds, but a quote has no "paid" or "cancelled" state in the app.
 */
export const IMPORT_STATUSES_BY_KIND: Record<BillingDocumentKind, ImportBillingDocumentStatus[]> = {
  devis: ["draft", "sent"],
  facture: ["draft", "sent", "paid", "cancelled"],
};

/** Historical documents were usually sent (quotes) or settled (invoices). */
export const DEFAULT_IMPORT_STATUS: Record<BillingDocumentKind, ImportBillingDocumentStatus> = {
  devis: "sent",
  facture: "paid",
};

const MAX_NUMBER_LENGTH = 32;
const MAX_ITEMS = 200;
const MAX_QUANTITY = 9999999;
const MAX_UNIT_PRICE = 999999999;

/** Case, accents and spacing ignored when a status cell is matched. */
function foldLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Status cells: the API values, plus the labels Folio shows for them in
 * French and Vietnamese, since a spreadsheet is usually filled in with those.
 */
const STATUS_BY_LABEL: ReadonlyMap<string, ImportBillingDocumentStatus> = new Map(
  (
    [
      ["draft", ["draft", "brouillon", "nháp"]],
      ["sent", ["sent", "envoyé", "envoyée", "đã gửi"]],
      ["paid", ["paid", "payé", "payée", "đã thanh toán"]],
      ["cancelled", ["cancelled", "canceled", "annulé", "annulée", "đã hủy"]],
    ] as const
  ).flatMap(([status, labels]) => labels.map((label) => [foldLabel(label), status] as const))
);

type TextField =
  | "recipient_name"
  | "recipient_address"
  | "recipient_email"
  | "recipient_siret"
  | "notes"
  | "terms"
  | "signature_block_text"
  | "payment_terms";

/** Maximum lengths the API enforces (email and SIRET have none of their own). */
const TEXT_LIMITS: Record<TextField, number> = {
  recipient_name: 255,
  recipient_address: 500,
  recipient_email: Number.POSITIVE_INFINITY,
  recipient_siret: Number.POSITIVE_INFINITY,
  notes: 2000,
  terms: 2000,
  signature_block_text: 500,
  payment_terms: 500,
};
const OPTIONAL_TEXT_FIELDS: TextField[] = [
  "recipient_address",
  "recipient_email",
  "recipient_siret",
  "notes",
  "terms",
  "signature_block_text",
  "payment_terms",
];

const DATE_FIELDS = ["issue_date", "validity_until", "payment_due_date"] as const;

const DOCUMENT_COLUMNS = [
  "kind",
  "document_number",
  "status",
  "recipient_name",
  ...OPTIONAL_TEXT_FIELDS,
  ...DATE_FIELDS,
  "created_at",
] as const;
const ITEM_COLUMNS = ["description", "quantity", "unit_price", "vat_rate", "category"] as const;

/** Columns a CSV must have; the others are optional. */
export const REQUIRED_CSV_COLUMNS = [
  "document_number",
  "recipient_name",
  "description",
  "quantity",
  "unit_price",
  "vat_rate",
] as const;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A document ready to send, minus the issuing company chosen in the dialog. */
export type BillingImportDocument = Omit<ImportBillingDocumentPayload, "company_id">;

/** Where a problem sits in the file: a document number, a CSV line or a JSON position. */
export type BillingImportRef =
  | { type: "number"; value: string }
  | { type: "line"; value: number }
  | { type: "position"; value: number };

export type BillingImportIssueCode =
  | "missingNumber"
  | "numberTooLong"
  | "missingRecipient"
  | "tooLong"
  | "noItems"
  | "tooManyItems"
  | "invalidItem"
  | "invalidItemLine"
  | "invalidStatus"
  | "invalidDate"
  | "ambiguousDate"
  | "invalidEmail"
  | "wrongKind"
  | "documentTooLarge";

export interface BillingImportIssue {
  ref: BillingImportRef;
  code: BillingImportIssueCode;
  params?: Record<string, string | number>;
}

export type BillingImportParseResult =
  | { ok: true; documents: BillingImportDocument[]; issues: BillingImportIssue[] }
  | { ok: false; error: "unreadable" | "empty" | "missingColumns"; columns?: string[] };

// ---------------------------------------------------------------------------
// Raw shape shared by the JSON and CSV readers
// ---------------------------------------------------------------------------

interface RawItem {
  /** 1-based position in the document (JSON) or file line (CSV). */
  at: number;
  fromLine: boolean;
  fields: Record<string, unknown>;
}

interface RawDocument {
  ref: BillingImportRef;
  fields: Record<string, unknown>;
  items: RawItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rawFromJsonDocument(value: unknown, position: number): RawDocument {
  const fields = isRecord(value) ? value : {};
  const number = cleanText(fields.document_number);
  const items = Array.isArray(fields.items) ? fields.items : [];
  return {
    ref: number ? { type: "number", value: number } : { type: "position", value: position },
    fields,
    items: items.map((item, i) => ({
      at: i + 1,
      fromLine: false,
      fields: isRecord(item) ? item : {},
    })),
  };
}

function readJson(text: string): RawDocument[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  let list: unknown[];
  if (Array.isArray(parsed)) list = parsed;
  else if (isRecord(parsed) && Array.isArray(parsed.documents)) list = parsed.documents;
  else if (
    isRecord(parsed) &&
    Array.isArray(parsed.items) &&
    parsed.items.some((i) => isRecord(i) && "document_number" in i)
  )
    list = parsed.items; // a GET /billing-documents list response
  else if (isRecord(parsed)) list = [parsed];
  else return null;
  return list.map((doc, i) => rawFromJsonDocument(doc, i + 1));
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

type CsvRead =
  | { ok: true; documents: RawDocument[]; issues: BillingImportIssue[] }
  | { ok: false; error: "empty" | "missingColumns"; columns?: string[] };

function readCsv(text: string): CsvRead {
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "empty" };
  const header = rows[0].cells.map(normalizeHeader);
  const missing = REQUIRED_CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) return { ok: false, error: "missingColumns", columns: [...missing] };

  const known = new Set<string>([...DOCUMENT_COLUMNS, ...ITEM_COLUMNS]);
  const byNumber = new Map<string, RawDocument>();
  const issues: BillingImportIssue[] = [];

  for (const row of rows.slice(1)) {
    const record: Record<string, string> = {};
    header.forEach((column, i) => {
      if (known.has(column)) record[column] = (row.cells[i] ?? "").trim();
    });
    const number = record.document_number;
    if (!number) {
      issues.push({ ref: { type: "line", value: row.line }, code: "missingNumber" });
      continue;
    }
    let doc = byNumber.get(number);
    if (!doc) {
      doc = { ref: { type: "number", value: number }, fields: {}, items: [] };
      byNumber.set(number, doc);
    }
    for (const column of DOCUMENT_COLUMNS) {
      if (record[column] && doc.fields[column] === undefined) doc.fields[column] = record[column];
    }
    const itemFields = Object.fromEntries(ITEM_COLUMNS.map((c) => [c, record[c] ?? ""]));
    // A row may only carry document columns (e.g. the notes); it adds no line item.
    if (ITEM_COLUMNS.some((c) => itemFields[c] !== "")) {
      doc.items.push({ at: row.line, fromLine: true, fields: itemFields });
    }
  }
  return { ok: true, documents: [...byNumber.values()], issues };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function toItem(fields: Record<string, unknown>): BillingDocumentItem | null {
  const description = cleanText(fields.description);
  const quantity = normalizeDecimal(fields.quantity);
  const unitPrice = normalizeDecimal(fields.unit_price);
  const vatRate = normalizeDecimal(fields.vat_rate);
  const category = cleanText(fields.category);
  if (!description || description.length > 5000) return null;
  if (quantity === null || Number(quantity) <= 0 || Number(quantity) > MAX_QUANTITY) return null;
  if (unitPrice === null || Number(unitPrice) < 0 || Number(unitPrice) > MAX_UNIT_PRICE) return null;
  if (vatRate === null || Number(vatRate) < 0 || Number(vatRate) > 100) return null;
  if (category && category.length > 120) return null;
  return {
    description,
    quantity,
    unit_price: unitPrice,
    vat_rate: vatRate,
    ...(category ? { category } : {}),
  };
}

interface ValidateContext {
  kind: BillingDocumentKind;
  defaultStatus: ImportBillingDocumentStatus;
  /** How to read short dates such as 03/04/2025; null refuses the ambiguous ones. */
  dateOrder: DateOrder | null;
}

function validate(
  raw: RawDocument,
  { kind, defaultStatus, dateOrder }: ValidateContext
): BillingImportDocument | BillingImportIssue {
  const f = raw.fields;
  const issue = (code: BillingImportIssueCode, params?: BillingImportIssue["params"]) => ({
    ref: raw.ref,
    code,
    ...(params ? { params } : {}),
  });

  const rawKind = cleanText(f.kind)?.toLowerCase();
  if (rawKind && rawKind !== kind) return issue("wrongKind", { value: rawKind });

  const number = cleanText(f.document_number);
  if (!number) return issue("missingNumber");
  if (number.length > MAX_NUMBER_LENGTH) return issue("numberTooLong", { max: MAX_NUMBER_LENGTH });

  const recipient = cleanText(f.recipient_name);
  if (!recipient) return issue("missingRecipient");

  const texts: Partial<Record<TextField, string>> = { recipient_name: recipient };
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const value = cleanText(f[field]);
    if (value) texts[field] = value;
  }
  for (const [field, value] of Object.entries(texts)) {
    const max = TEXT_LIMITS[field as TextField];
    if (value.length > max) return issue("tooLong", { field, max });
  }
  if (texts.recipient_email && !isPlausibleEmail(texts.recipient_email)) {
    return issue("invalidEmail", { value: texts.recipient_email });
  }

  const rawStatus = cleanText(f.status);
  const status = rawStatus ? STATUS_BY_LABEL.get(foldLabel(rawStatus)) : defaultStatus;
  if (!status || !IMPORT_STATUSES_BY_KIND[kind].includes(status)) {
    return issue("invalidStatus", { value: rawStatus ?? "" });
  }

  const dates: Partial<Record<(typeof DATE_FIELDS)[number], string>> = {};
  for (const field of DATE_FIELDS) {
    const value = cleanText(f[field]);
    if (value === null) continue;
    const iso = normalizeIsoDate(value, dateOrder);
    if (!iso) {
      return dateOrder === null && isAmbiguousDate(value)
        ? issue("ambiguousDate", { field, value })
        : issue("invalidDate", { field });
    }
    dates[field] = iso;
  }
  const createdAt = cleanText(f.created_at);
  if (createdAt && !isIsoDateTime(createdAt)) return issue("invalidDate", { field: "created_at" });

  if (raw.items.length === 0) return issue("noItems");
  if (raw.items.length > MAX_ITEMS) return issue("tooManyItems", { max: MAX_ITEMS });
  const items: BillingDocumentItem[] = [];
  for (const rawItem of raw.items) {
    const item = toItem(rawItem.fields);
    if (!item) {
      return rawItem.fromLine
        ? issue("invalidItemLine", { line: rawItem.at })
        : issue("invalidItem", { position: rawItem.at });
    }
    items.push(item);
  }

  const document: BillingImportDocument = {
    kind,
    document_number: number,
    status,
    ...texts,
    recipient_name: recipient,
    ...dates,
    ...(createdAt ? { created_at: createdAt } : {}),
    items,
  };
  // Hundreds of long line items would not fit in one request.
  if (jsonByteLength(document) > MAX_ACTION_PAYLOAD_BYTES) return issue("documentTooLarge");
  return document;
}

function isIssue(value: BillingImportDocument | BillingImportIssue): value is BillingImportIssue {
  return "code" in value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** JSON when the name ends in .json or the content starts like JSON; CSV otherwise. */
function looksLikeJson(fileName: string, text: string): boolean {
  if (fileName.toLowerCase().endsWith(".json")) return true;
  if (fileName.toLowerCase().endsWith(".csv")) return false;
  return /^[\s﻿]*[[{]/.test(text);
}

export interface BillingImportParseOptions {
  /**
   * Read a short date such as 03/04/2025 as day-first when no other date of
   * the file settles the order (French and Vietnamese habit). When false,
   * such dates are refused and the user asked for YYYY-MM-DD.
   */
  assumeDayFirst?: boolean;
}

export function parseBillingImportFile(
  text: string,
  fileName: string,
  kind: BillingDocumentKind,
  defaultStatus: ImportBillingDocumentStatus,
  { assumeDayFirst = true }: BillingImportParseOptions = {}
): BillingImportParseResult {
  let raws: RawDocument[];
  const issues: BillingImportIssue[] = [];
  if (looksLikeJson(fileName, text)) {
    const read = readJson(text.replace(/^﻿/, ""));
    if (!read) return { ok: false, error: "unreadable" };
    raws = read;
  } else {
    const read = readCsv(text);
    if (!read.ok) return read;
    raws = read.documents;
    issues.push(...read.issues);
  }
  if (raws.length === 0 && issues.length === 0) return { ok: false, error: "empty" };

  // The order is read from the whole file: one 25/03 settles every 03/04.
  const detected = detectDateOrder(raws.flatMap((raw) => DATE_FIELDS.map((f) => raw.fields[f])));
  const dateOrder =
    detected === "mixed" ? null : (detected ?? (assumeDayFirst ? "dmy" : null));

  const documents: BillingImportDocument[] = [];
  for (const raw of raws) {
    const result = validate(raw, { kind, defaultStatus, dateOrder });
    if (isIssue(result)) issues.push(result);
    else documents.push(result);
  }
  return { ok: true, documents, issues };
}

/** Header-only CSV template (UTF-8 with BOM so Excel keeps accents). */
export function buildBillingImportTemplate(kind: BillingDocumentKind, delimiter: string): string {
  const columns = [
    "document_number",
    "status",
    "issue_date",
    kind === "devis" ? "validity_until" : "payment_due_date",
    ...(kind === "facture" ? ["payment_terms"] : []),
    "recipient_name",
    "recipient_address",
    "recipient_email",
    "recipient_siret",
    "notes",
    "description",
    "quantity",
    "unit_price",
    "vat_rate",
    "category",
  ];
  return `﻿${columns.map((c) => toCsvCell(c, delimiter)).join(delimiter)}\r\n`;
}
