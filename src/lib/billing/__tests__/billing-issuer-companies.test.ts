/**
 * fetchBillingIssuerCompanies — the billing import is offered for exactly
 * the companies creation allows: those where the caller is admin, with no
 * platform-ops shortcut. /companies is only fetched when there is one.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/companies/companies", () => ({
  fetchMyCompanies: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { getSession } from "@/lib/auth/session";
import { fetchBillingIssuerCompanies } from "@/lib/billing/billing-issuer-companies";
import type { AuthSession } from "@/lib/auth/types";
import type { CompanyRole, MyCompany } from "@/types/companies";

const mockFetchCompanies = vi.mocked(fetchMyCompanies);
const mockGetSession = vi.mocked(getSession);

function session(roles: CompanyRole[], permissions: string[] = []): AuthSession {
  return {
    accessToken: "t",
    expiresAt: Date.now() + 60_000,
    user: {
      id: "u-1",
      email: "u@example.com",
      permissions,
      companies: roles.map((role, i) => ({
        id: `co-${i + 1}`,
        legal_name: `Company ${i + 1}`,
        role,
        is_primary: i === 0,
      })),
    },
  };
}

function company(id: string, role: CompanyRole): MyCompany {
  return { id, legal_name: id, role, is_primary: false, attached_at: "2026-01-01" } as MyCompany;
}

beforeEach(() => vi.clearAllMocks());

describe("fetchBillingIssuerCompanies", () => {
  it("returns only the companies the caller administers", async () => {
    mockGetSession.mockResolvedValue(session(["admin", "member"]));
    mockFetchCompanies.mockResolvedValue([company("co-1", "admin"), company("co-2", "member")]);

    expect((await fetchBillingIssuerCompanies()).map((c) => c.id)).toEqual(["co-1"]);
  });

  it("gives platform ops no shortcut: a plain member is offered nothing", async () => {
    mockGetSession.mockResolvedValue(session(["member", "manager"], ["*:*"]));

    expect(await fetchBillingIssuerCompanies()).toEqual([]);
    expect(mockFetchCompanies).not.toHaveBeenCalled();
  });

  it("offers nothing without a session, and nothing when /companies fails", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await fetchBillingIssuerCompanies()).toEqual([]);
    expect(mockFetchCompanies).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetSession.mockResolvedValue(session(["admin"]));
    mockFetchCompanies.mockRejectedValue(new Error("down"));
    expect(await fetchBillingIssuerCompanies()).toEqual([]);
    warn.mockRestore();
  });
});
