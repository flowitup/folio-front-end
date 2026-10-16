/**
 * billing-10: a list page past 200 rows is read in chunks the API accepts
 * (max 200 per request), so "load more" keeps adding documents.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/billing/documents", () => ({ fetchBillingDocuments: vi.fn() }));
vi.mock("@/lib/billing/billing-issuer-companies", () => ({
  fetchBillingIssuerCompanies: vi.fn().mockResolvedValue([]),
}));
vi.mock("../billing-document-list", () => ({ BillingDocumentList: () => null }));

import { fetchBillingDocuments } from "@/lib/api/billing/documents";
import { BillingListPage } from "../billing-list-page";
import { BILLING_LIST_PAGE_SIZE } from "../billing-list-params";

const TOTAL = 207;
const ALL = Array.from({ length: TOTAL }, (_, i) => ({ id: `d${i}` }));

describe("BillingListPage deep pages", () => {
  it("reads past 200 rows in API-sized chunks", async () => {
    vi.mocked(fetchBillingDocuments).mockImplementation(async (params) => {
      const limit = Math.min(params.limit ?? 25, 200);
      const offset = params.offset ?? 0;
      return { items: ALL.slice(offset, offset + limit), total: TOTAL } as never;
    });
    const page = Math.ceil(TOTAL / BILLING_LIST_PAGE_SIZE) + 1;
    const element = await BillingListPage({ kind: "devis", searchParams: { page: String(page) } });
    const props = (element as { props: { initialDocuments: unknown[]; initialTotal: number } }).props;
    expect(props.initialDocuments).toHaveLength(TOTAL);
    expect(props.initialTotal).toBe(TOTAL);
    for (const [params] of vi.mocked(fetchBillingDocuments).mock.calls) {
      expect(params.limit).toBeLessThanOrEqual(200);
    }
  });
});
