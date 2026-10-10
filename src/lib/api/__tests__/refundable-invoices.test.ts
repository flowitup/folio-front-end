/**
 * Refundable-expenses API client: both listings send the page and the search
 * (`q`, trimmed, left out when blank) to GET /billing/materials-expenses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/http", () => ({
  api: { get: vi.fn().mockResolvedValue({ items: [], total: 0, summary: null }) },
}));

import { api } from "@/lib/api/http";
import { fetchRefundableCandidates, fetchRefundableExpenses } from "@/lib/api/billing/refundable-invoices";

function lastQuery(): URLSearchParams {
  const path = vi.mocked(api.get).mock.lastCall![0] as string;
  expect(path.startsWith("/billing/materials-expenses?")).toBe(true);
  return new URLSearchParams(path.split("?")[1]);
}

beforeEach(() => vi.mocked(api.get).mockClear());

describe("refundable-invoices API client", () => {
  it("asks for the first 200 candidates with no search by default", async () => {
    await fetchRefundableCandidates();
    expect(Object.fromEntries(lastQuery())).toEqual({ refundable: "false", limit: "200" });
  });

  it("sends a trimmed search and the offset of the next page", async () => {
    await fetchRefundableCandidates({ q: "  Supplier 000 ", offset: 200 });
    expect(Object.fromEntries(lastQuery())).toEqual({
      refundable: "false",
      limit: "200",
      offset: "200",
      q: "Supplier 000",
    });
  });

  it("leaves a blank search out", async () => {
    await fetchRefundableExpenses({ q: "   ", companyId: "c1" });
    expect(Object.fromEntries(lastQuery())).toEqual({ refundable: "true", company_id: "c1", limit: "200" });
  });
});
