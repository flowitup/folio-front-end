/**
 * invite-tokens.test.ts — API client smoke tests for generate / revoke / redeem.
 * Strategy: mock global fetch deterministically, assert URL / method / body.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 'server-only' is aliased to a no-op stub in vitest.config.ts — no mock needed here.
vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));
vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import {
  generateInviteToken,
  revokeInviteToken,
  redeemInviteToken,
} from "@/lib/api/companies/invite-tokens";

const BASE = "http://localhost:3001/api/v1";

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// generateInviteToken
// ---------------------------------------------------------------------------

describe("generateInviteToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs /companies/:id/invite-tokens without query when regenerate=false", async () => {
    const tokenData = { token: "tok-abc", token_id: "tid-1", expires_at: "2026-06-01T00:00:00Z" };
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(tokenData));

    const result = await generateInviteToken("co-1");
    expect(result).toEqual(tokenData);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1/invite-tokens`);
    expect(init.method).toBe("POST");
  });

  it("appends regenerate=true when requested", async () => {
    const tokenData = { token: "tok-new", token_id: "tid-2", expires_at: "2026-06-01T00:00:00Z" };
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(tokenData));

    await generateInviteToken("co-1", { regenerate: true });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("regenerate=true");
  });

  it("throws on 409 active_token_exists", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reason: "active_token_exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        })
      );
    await expect(generateInviteToken("co-1")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// revokeInviteToken
// ---------------------------------------------------------------------------

describe("revokeInviteToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DELETEs /companies/:id/invite-tokens/active", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await revokeInviteToken("co-1");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1/invite-tokens/active`);
    expect(init.method).toBe("DELETE");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(revokeInviteToken("missing")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// redeemInviteToken
// ---------------------------------------------------------------------------

describe("redeemInviteToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs /companies/attach-by-token with token body", async () => {
    const company = {
      id: "co-1",
      legal_name: "ACME",
      address: "Paris",
      siret: null,
      tva_number: null,
      iban: null,
      bic: null,
      logo_url: null,
      default_payment_terms: null,
      prefix_override: null,
      created_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_primary: false,
      attached_at: "2026-05-07T00:00:00Z",
    };
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(company));

    const result = await redeemInviteToken("mytoken");
    expect(result).toEqual(company);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/attach-by-token`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token: "mytoken" });
  });

  it("throws on 410 (expired / already-redeemed)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 410 }));
    await expect(redeemInviteToken("expired-token")).rejects.toThrow();
  });
});
