/**
 * test_api_client_documents_url_method_body_contract
 *
 * Smoke tests for the billing documents API client.
 * Mocks global fetch; verifies URL, method, headers, and body for each function.
 *
 * NOTE: These are server-only functions that use sessionAuthHeader (next/headers).
 * We mock the auth header dependency so we can test without a real session.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports of the mocked modules
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

vi.mock("@/lib/api/_helpers/content-disposition", () => ({
  parseFilenameFromContentDisposition: vi.fn().mockReturnValue("billing-document-test.pdf"),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  fetchBillingDocuments,
  fetchBillingDocument,
  createBillingDocument,
  updateBillingDocument,
  deleteBillingDocument,
  cloneBillingDocument,
  convertDevisToFacture,
  updateBillingDocumentStatus,
  fetchBillingDocumentPdf,
  createBillingDocumentFromTemplate,
} from "@/lib/api/billing/documents";
import type { BillingDocument, BillingDocumentItem } from "@/types/billing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3001/api/v1";
const AUTH_HEADER = { Authorization: "Bearer test-token" };

function makeOkResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function make204Response(): Response {
  return new Response(null, { status: 204 });
}

const SAMPLE_ITEM: BillingDocumentItem = {
  description: "Consulting",
  quantity: "2",
  unit_price: "100",
  vat_rate: "20",
};

const SAMPLE_DOC: BillingDocument = {
  id: "doc-1",
  user_id: "user-1",
  project_id: null,
  kind: "devis",
  document_number: "DEV-2026-001",
  status: "draft",
  issue_date: "2026-01-01",
  validity_until: null,
  payment_due_date: null,
  payment_terms: null,
  recipient_name: "ACME Corp",
  recipient_address: null,
  recipient_email: null,
  recipient_siret: null,
  notes: null,
  terms: null,
  signature_block_text: null,
  items: [SAMPLE_ITEM],
  issuer_legal_name: "My Company",
  issuer_address: "123 Main St",
  issuer_siret: null,
  issuer_tva_number: null,
  issuer_iban: null,
  issuer_bic: null,
  issuer_logo_url: null,
  source_devis_id: null,
  total_ht: "200",
  total_tva: "40",
  total_ttc: "240",
  vat_breakdown: [{ rate: "20", base_ht: "200", tva_amount: "40" }],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// test_api_client_documents_url_method_body_contract
// ---------------------------------------------------------------------------

describe("test_api_client_documents_url_method_body_contract", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchBillingDocuments
  // ---------------------------------------------------------------------------

  describe("fetchBillingDocuments", () => {
    it("GET /billing-documents?kind=devis — URL, method, auth header", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ items: [], total: 0 }));

      await fetchBillingDocuments({ kind: "devis" });

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(`${BASE_URL}/billing-documents`);
      expect(url).toContain("kind=devis");
      expect(init.method).toBe("GET");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe(AUTH_HEADER.Authorization);
    });

    it("appends optional filters to query string", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ items: [], total: 0 }));

      await fetchBillingDocuments({ kind: "facture", status: "paid", project_id: "proj-1", limit: 10, offset: 20 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("kind=facture");
      expect(url).toContain("status=paid");
      expect(url).toContain("project_id=proj-1");
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=20");
    });

    it("throws on non-ok response", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })
      );
      await expect(fetchBillingDocuments({ kind: "devis" })).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // fetchBillingDocument
  // ---------------------------------------------------------------------------

  describe("fetchBillingDocument", () => {
    it("GET /billing-documents/:id — correct URL and method", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      await fetchBillingDocument("doc-1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1`);
      expect(init.method).toBe("GET");
    });

    it("encodes special characters in id", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      await fetchBillingDocument("doc/special");

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("doc%2Fspecial");
    });
  });

  // ---------------------------------------------------------------------------
  // createBillingDocument
  // ---------------------------------------------------------------------------

  describe("createBillingDocument", () => {
    it("POST /billing-documents — correct method and body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      const payload = {
        kind: "devis" as const,
        company_id: "company-1",
        recipient_name: "ACME Corp",
        items: [SAMPLE_ITEM],
      };

      await createBillingDocument(payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.kind).toBe("devis");
      expect(body.recipient_name).toBe("ACME Corp");
      expect(body.items).toHaveLength(1);
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });
  });

  // ---------------------------------------------------------------------------
  // updateBillingDocument
  // ---------------------------------------------------------------------------

  describe("updateBillingDocument", () => {
    it("PUT /billing-documents/:id — correct URL, method and partial payload", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      const payload = { recipient_name: "New Name" };
      await updateBillingDocument("doc-1", payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1`);
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string);
      expect(body.recipient_name).toBe("New Name");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteBillingDocument
  // ---------------------------------------------------------------------------

  describe("deleteBillingDocument", () => {
    it("DELETE /billing-documents/:id — correct URL and method", async () => {
      fetchMock.mockResolvedValueOnce(make204Response());

      await deleteBillingDocument("doc-1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1`);
      expect(init.method).toBe("DELETE");
    });
  });

  // ---------------------------------------------------------------------------
  // cloneBillingDocument
  // ---------------------------------------------------------------------------

  describe("cloneBillingDocument", () => {
    it("POST /billing-documents/:id/clone — URL and body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      await cloneBillingDocument("doc-1", { override_kind: "facture" });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1/clone`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.override_kind).toBe("facture");
    });

    it("sends empty object when no payload provided", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      await cloneBillingDocument("doc-1");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({});
    });
  });

  // ---------------------------------------------------------------------------
  // convertDevisToFacture
  // ---------------------------------------------------------------------------

  describe("convertDevisToFacture", () => {
    it("POST /billing-documents/:id/convert-to-facture", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ ...SAMPLE_DOC, kind: "facture" }));

      await convertDevisToFacture("doc-1", { payment_due_date: "2026-02-01" });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1/convert-to-facture`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.payment_due_date).toBe("2026-02-01");
    });
  });

  // ---------------------------------------------------------------------------
  // updateBillingDocumentStatus
  // ---------------------------------------------------------------------------

  describe("updateBillingDocumentStatus", () => {
    it("PATCH /billing-documents/:id/status — sends new_status in body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ ...SAMPLE_DOC, status: "sent" }));

      await updateBillingDocumentStatus("doc-1", "sent");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1/status`);
      expect(init.method).toBe("PATCH");
      const body = JSON.parse(init.body as string);
      expect(body.new_status).toBe("sent");
    });
  });

  // ---------------------------------------------------------------------------
  // test_pdf_download_parses_filename_from_content_disposition
  // ---------------------------------------------------------------------------

  describe("test_pdf_download_parses_filename_from_content_disposition", () => {
    it("fetches PDF and parses filename from Content-Disposition header", async () => {
      const fakeBlob = new Blob(["pdf-bytes"], { type: "application/pdf" });
      const headers = new Headers({
        "Content-Disposition": 'attachment; filename="DEV-2026-001.pdf"',
      });
      fetchMock.mockResolvedValueOnce(new Response(fakeBlob, { status: 200, headers }));

      const result = await fetchBillingDocumentPdf("doc-1");

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/billing-documents/doc-1/pdf`);
      // parseFilenameFromContentDisposition is mocked to return "billing-document-test.pdf"
      expect(result.filename).toBe("billing-document-test.pdf");
      expect(result.blob).toBeTruthy();
    });

    it("throws on non-ok PDF response", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(fetchBillingDocumentPdf("doc-1")).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // createBillingDocumentFromTemplate
  // ---------------------------------------------------------------------------

  describe("createBillingDocumentFromTemplate", () => {
    it("POST /billing-documents/from-template/:id — URL, method, body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_DOC));

      const payload = {
        recipient_name: "Client X",
        recipient_address: "123 Rue Main",
        recipient_email: null,
        recipient_siret: null,
      };

      await createBillingDocumentFromTemplate("tpl-1", payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-documents/from-template/tpl-1`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.recipient_name).toBe("Client X");
    });
  });

  // ---------------------------------------------------------------------------
  // Network error path
  // ---------------------------------------------------------------------------

  describe("network errors", () => {
    it("throws a descriptive error when fetch rejects (network failure)", async () => {
      fetchMock.mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"));

      await expect(fetchBillingDocuments({ kind: "devis" })).rejects.toThrow(
        "Network error"
      );
    });
  });
});
