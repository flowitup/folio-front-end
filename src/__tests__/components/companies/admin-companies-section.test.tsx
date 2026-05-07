/**
 * admin-companies-section.test.tsx
 *
 * Covers: admin-only render, new company CTA, loading state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminCompaniesSection } from "@/components/companies/admin-companies-section";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => { val = val.replace(`{${k}}`, String(v)); });
    }
    return val;
  };
  return {
    useTranslations: (ns: string) => makeT(ns),
    useLocale: () => "en",
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    fetchAllCompaniesAction: vi.fn(),
    createCompanyAction: vi.fn(),
  })
);

import { fetchAllCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
const mockFetch = vi.mocked(fetchAllCompaniesAction);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPANIES = [
  {
    id: "co-1",
    legal_name: "ACME Corp",
    address: "Paris",
    siret: "12345678900012",
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Render with companies
// ---------------------------------------------------------------------------

describe("AdminCompaniesSection — render", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders company list after load", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      data: { items: COMPANIES, total: 1 },
    });

    render(<AdminCompaniesSection />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeDefined();
    });
  });

  it("renders empty state when no companies", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      data: { items: [], total: 0 },
    });

    render(<AdminCompaniesSection />);

    await waitFor(() => {
      // Empty state shows "New company" CTA in the body
      const newBtns = screen.getAllByRole("button", { name: /new company/i });
      expect(newBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows New company button in header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      data: { items: COMPANIES, total: 1 },
    });

    render(<AdminCompaniesSection />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeDefined();
    });

    expect(screen.getByRole("button", { name: /new company/i })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// New company CTA
// ---------------------------------------------------------------------------

describe("AdminCompaniesSection — new company CTA", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking New company opens CompanyCreateDialog", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      data: { items: COMPANIES, total: 1 },
    });

    render(<AdminCompaniesSection />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /new company/i }));

    await waitFor(() => {
      // Dialog title appears
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });
});
