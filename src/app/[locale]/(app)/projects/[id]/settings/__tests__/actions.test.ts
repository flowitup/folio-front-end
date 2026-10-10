/**
 * Project settings server actions — an unreachable API is a result the form
 * can toast, not a thrown action that leaves Save on "Saving…".
 */

import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: "t" }),
}));
vi.mock("@/lib/api/auth-header", () => ({ sessionAuthHeader: vi.fn().mockResolvedValue({}) }));

import { updateBankCredit, updateInvoicePrefix } from "../actions";

afterEach(() => vi.unstubAllGlobals());

describe("project settings actions — API unreachable", () => {
  it("updateInvoicePrefix returns an error result when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await updateInvoicePrefix("p1", "QAV")).toEqual({ ok: false, error: "unknown" });
  });

  it("updateBankCredit returns an error result when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await updateBankCredit("p1", "12345", "")).toEqual({ ok: false, error: "unknown" });
  });

  it("still saves when the API answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    expect(await updateBankCredit("p1", "12345", "")).toEqual({ ok: true });
  });
});
