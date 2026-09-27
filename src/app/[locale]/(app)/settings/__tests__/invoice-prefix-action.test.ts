import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ accessToken: "t" }),
}));
vi.mock("@/lib/api/auth-header", () => ({ sessionAuthHeader: vi.fn().mockResolvedValue({}) }));

import { updateInvoicePrefix } from "../_actions/invoice-prefix-actions";

afterEach(() => vi.unstubAllGlobals());

describe("updateInvoicePrefix", () => {
  it('sends "" to clear the prefix, since the backend reads null as unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await updateInvoicePrefix("p1", "  ")).toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ invoice_prefix: "" });
  });
});
