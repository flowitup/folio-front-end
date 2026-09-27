/**
 * importBillingDocumentAction — session guard, id check, and the error codes
 * the import dialog relies on (a taken number is "skipped", not a failure).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/billing/documents", () => ({ importBillingDocument: vi.fn() }));
vi.mock("@/lib/api/billing/templates", () => ({}));

import { importBillingDocumentAction } from "../billing-actions";
import { importBillingDocument } from "@/lib/api/billing/documents";
import { getSession } from "@/lib/auth/session";
import type { ImportBillingDocumentPayload } from "@/types/billing";

const mockImport = vi.mocked(importBillingDocument);
const mockSession = vi.mocked(getSession);

const COMPANY = "11111111-2222-3333-4444-555555555555";

const PAYLOAD: ImportBillingDocumentPayload = {
  kind: "facture",
  company_id: COMPANY,
  document_number: "FAC-2024-001",
  status: "paid",
  recipient_name: "Client",
  items: [{ description: "Work", quantity: "1", unit_price: "100", vat_rate: "20" }],
};

function httpError(status: number, body: Record<string, unknown> | null) {
  return Object.assign(new Error(`HTTP ${status}`), { status, body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.mockResolvedValue({ accessToken: "t" } as Awaited<ReturnType<typeof getSession>>);
});

describe("importBillingDocumentAction", () => {
  it("returns the imported document", async () => {
    mockImport.mockResolvedValueOnce({ id: "doc-1" } as never);
    const result = await importBillingDocumentAction(PAYLOAD);
    expect(result).toEqual({ ok: true, data: { id: "doc-1" } });
    expect(mockImport).toHaveBeenCalledWith(PAYLOAD);
  });

  it("maps a taken number to document_already_exists", async () => {
    mockImport.mockRejectedValueOnce(
      httpError(409, { error: "Conflict", reason: "document_already_exists", message: "exists" })
    );
    const result = await importBillingDocumentAction(PAYLOAD);
    expect(result).toEqual({
      ok: false,
      error: { code: "document_already_exists", message: "exists" },
    });
  });

  it("maps rate limits and validation errors", async () => {
    mockImport.mockRejectedValueOnce(httpError(429, null));
    expect(await importBillingDocumentAction(PAYLOAD)).toMatchObject({
      ok: false,
      error: { code: "rate_limited" },
    });

    mockImport.mockRejectedValueOnce(
      httpError(422, { error: "validation_error", message: "items.0.quantity: too big" })
    );
    expect(await importBillingDocumentAction(PAYLOAD)).toEqual({
      ok: false,
      error: { code: "validation", message: "items.0.quantity: too big" },
    });
  });

  it("refuses without a session or with a malformed company id, without calling the API", async () => {
    mockSession.mockResolvedValueOnce(null);
    expect(await importBillingDocumentAction(PAYLOAD)).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });

    expect(await importBillingDocumentAction({ ...PAYLOAD, company_id: "nope" })).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
    expect(mockImport).not.toHaveBeenCalled();
  });
});
