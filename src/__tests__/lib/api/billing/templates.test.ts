/**
 * API client smoke tests for billing templates.
 * Mocks global fetch; verifies URL, method, headers, and body for each function.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import {
  fetchBillingTemplates,
  fetchBillingTemplate,
  createBillingTemplate,
  updateBillingTemplate,
  deleteBillingTemplate,
} from "@/lib/api/billing/templates";
import type { BillingDocumentTemplate } from "@/types/billing";

const BASE_URL = "http://localhost:3001/api/v1";

function makeOkResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_TPL: BillingDocumentTemplate = {
  id: "tpl-1",
  user_id: "user-1",
  kind: "devis",
  name: "Standard Consulting",
  notes: null,
  terms: null,
  default_vat_rate: "20",
  items: [{ description: "Consulting", quantity: "1", unit_price: "500", vat_rate: "20" }],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("billing templates API client", () => {
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
  // fetchBillingTemplates
  // ---------------------------------------------------------------------------

  describe("fetchBillingTemplates", () => {
    it("GET /billing-document-templates — no kind filter when omitted", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ items: [SAMPLE_TPL] }));

      const result = await fetchBillingTemplates();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-document-templates`);
      expect(init.method).toBe("GET");
      expect(result).toEqual([SAMPLE_TPL]);
    });

    it("appends kind=devis when specified", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ items: [] }));

      await fetchBillingTemplates("devis");

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("kind=devis");
    });

    it("appends kind=facture when specified", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse({ items: [] }));

      await fetchBillingTemplates("facture");

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain("kind=facture");
    });

    it("throws on non-ok response", async () => {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
      await expect(fetchBillingTemplates()).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // fetchBillingTemplate
  // ---------------------------------------------------------------------------

  describe("fetchBillingTemplate", () => {
    it("GET /billing-document-templates/:id", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_TPL));

      await fetchBillingTemplate("tpl-1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-document-templates/tpl-1`);
      expect(init.method).toBe("GET");
    });
  });

  // ---------------------------------------------------------------------------
  // createBillingTemplate
  // ---------------------------------------------------------------------------

  describe("createBillingTemplate", () => {
    it("POST /billing-document-templates — correct body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_TPL));

      const payload = {
        kind: "devis" as const,
        name: "Standard Consulting",
        items: SAMPLE_TPL.items,
        default_vat_rate: "20",
      };

      await createBillingTemplate(payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-document-templates`);
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.kind).toBe("devis");
      expect(body.name).toBe("Standard Consulting");
    });
  });

  // ---------------------------------------------------------------------------
  // updateBillingTemplate
  // ---------------------------------------------------------------------------

  describe("updateBillingTemplate", () => {
    it("PUT /billing-document-templates/:id — partial payload", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_TPL));

      await updateBillingTemplate("tpl-1", { name: "Updated Name" });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-document-templates/tpl-1`);
      expect(init.method).toBe("PUT");
      const body = JSON.parse(init.body as string);
      expect(body.name).toBe("Updated Name");
    });
  });

  // ---------------------------------------------------------------------------
  // deleteBillingTemplate
  // ---------------------------------------------------------------------------

  describe("deleteBillingTemplate", () => {
    it("DELETE /billing-document-templates/:id", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await deleteBillingTemplate("tpl-1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/billing-document-templates/tpl-1`);
      expect(init.method).toBe("DELETE");
    });
  });

  // ---------------------------------------------------------------------------
  // Network error
  // ---------------------------------------------------------------------------

  describe("network errors", () => {
    it("wraps fetch rejection in a descriptive error", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(fetchBillingTemplates()).rejects.toThrow("Network error");
    });
  });
});
