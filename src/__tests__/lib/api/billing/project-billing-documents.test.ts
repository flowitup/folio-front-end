/**
 * Contract test for the project billing documents browser wrapper:
 * GET /projects/<project_id>/billing-documents through the cookie-auth `api`
 * client (no /api/v1 prefix — env.apiBaseUrl already carries it), unwrapping
 * the `billing_documents` envelope.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/http", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api/http";
import { fetchProjectBillingDocuments } from "@/lib/api/billing/project-billing-documents";
import type { ProjectBillingDocumentSummary } from "@/types/billing";

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>;

const DOC: ProjectBillingDocumentSummary = {
  id: "doc-1",
  kind: "devis",
  document_number: "DEV-2026-001",
  status: "sent",
  issue_date: "2026-09-01",
  recipient_name: "ACME",
  total_ht: 100,
  total_ttc: 120,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchProjectBillingDocuments", () => {
  it("calls the project-scoped endpoint and returns the documents", async () => {
    mockGet.mockResolvedValue({ billing_documents: [DOC] });
    const controller = new AbortController();

    const docs = await fetchProjectBillingDocuments("proj-1", controller.signal);

    expect(mockGet).toHaveBeenCalledWith("/projects/proj-1/billing-documents", {
      signal: controller.signal,
    });
    expect(docs).toEqual([DOC]);
  });

  it("encodes the project id into the path", async () => {
    mockGet.mockResolvedValue({ billing_documents: [] });

    await fetchProjectBillingDocuments("a/b c");

    expect(mockGet).toHaveBeenCalledWith("/projects/a%2Fb%20c/billing-documents", {
      signal: undefined,
    });
  });

  it("returns an empty list when the envelope has no documents", async () => {
    mockGet.mockResolvedValue({});

    await expect(fetchProjectBillingDocuments("proj-1")).resolves.toEqual([]);
  });

  it("propagates API errors to the caller", async () => {
    mockGet.mockRejectedValue(new Error("HTTP 403"));

    await expect(fetchProjectBillingDocuments("proj-1")).rejects.toThrow("HTTP 403");
  });
});
