/**
 * API client smoke tests for billing company-profile.
 * Mocks global fetch; verifies URL, method, headers, and body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import { fetchCompanyProfile, upsertCompanyProfile } from "@/lib/api/billing/company-profile";
import type { CompanyProfile } from "@/types/billing";

const BASE_URL = "http://localhost:3001/api/v1";

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_PROFILE: CompanyProfile = {
  user_id: "user-1",
  legal_name: "Maison Lavandou SAS",
  address: "12 Rue de la Paix, 75001 Paris",
  siret: "12345678900012",
  tva_number: "FR12345678901",
  iban: null,
  bic: null,
  logo_url: null,
  default_payment_terms: "Net 30",
  prefix_override: "FLW",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("billing company-profile API client", () => {
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
  // fetchCompanyProfile
  // ---------------------------------------------------------------------------

  describe("fetchCompanyProfile", () => {
    it("GET /company-profile — correct URL and method", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_PROFILE));

      const result = await fetchCompanyProfile();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/company-profile`);
      expect(init.method).toBe("GET");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
      expect(result).toEqual(SAMPLE_PROFILE);
    });

    it("returns null on 404 (no profile yet)", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const result = await fetchCompanyProfile();

      expect(result).toBeNull();
    });

    it("throws on 500 error", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 })
      );

      await expect(fetchCompanyProfile()).rejects.toThrow();
    });

    it("throws a descriptive error on network failure", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(fetchCompanyProfile()).rejects.toThrow("Network error");
    });
  });

  // ---------------------------------------------------------------------------
  // upsertCompanyProfile
  // ---------------------------------------------------------------------------

  describe("upsertCompanyProfile", () => {
    it("PUT /company-profile — correct method and full body", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_PROFILE));

      const payload = {
        legal_name: "Maison Lavandou SAS",
        address: "12 Rue de la Paix, 75001 Paris",
        siret: "12345678900012",
        tva_number: "FR12345678901",
        iban: null,
        bic: null,
        logo_url: null,
        default_payment_terms: "Net 30",
        prefix_override: "FLW",
      };

      const result = await upsertCompanyProfile(payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/company-profile`);
      expect(init.method).toBe("PUT");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      const body = JSON.parse(init.body as string);
      expect(body.legal_name).toBe("Maison Lavandou SAS");
      expect(body.prefix_override).toBe("FLW");
      expect(result).toEqual(SAMPLE_PROFILE);
    });

    it("sends minimal payload (only required fields)", async () => {
      fetchMock.mockResolvedValueOnce(makeOkResponse(SAMPLE_PROFILE));

      const payload = {
        legal_name: "Simple Co",
        address: "1 Main St",
      };

      await upsertCompanyProfile(payload);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.legal_name).toBe("Simple Co");
      expect(body.address).toBe("1 Main St");
    });

    it("throws on 422 validation error", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "legal_name is required" }), { status: 422 })
      );

      await expect(upsertCompanyProfile({ legal_name: "", address: "" })).rejects.toThrow();
    });

    it("throws a descriptive error on network failure", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Network error"));

      await expect(
        upsertCompanyProfile({ legal_name: "X", address: "Y" })
      ).rejects.toThrow("Network error");
    });
  });
});
