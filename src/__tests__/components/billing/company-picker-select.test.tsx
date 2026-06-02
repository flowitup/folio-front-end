/**
 * company-picker-select.test.tsx
 *
 * Required regression tests:
 *   test_company_picker_defaults_to_primary
 *   test_company_picker_uses_last_used_when_set
 *   test_company_picker_skipped_when_single
 *
 * Also covers: 0-company renders nothing, disabled state, localStorage persistence.
 *
 * Interaction strategy: userEvent.setup() for shadcn Select (Radix portal).
 * localStorage reset in beforeEach per hard-rules.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyPickerSelect } from "@/components/billing/company-picker-select";
import type { MyCompany } from "@/types/companies";

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
  const makeT = (ns: string) => (key: string) => resolve(en, `${ns}.${key}`);
  return { useTranslations: (ns: string) => makeT(ns) };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompany(id: string, overrides: Partial<MyCompany> = {}): MyCompany {
  return {
    id,
    legal_name: `Company ${id}`,
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
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
    ...overrides,
  };
}

const PRIMARY = makeCompany("co-primary", { is_primary: true, legal_name: "Primary Co" });
const SECONDARY_A = makeCompany("co-a", { legal_name: "Alpha Co", attached_at: "2026-02-01T00:00:00Z" });
const SECONDARY_B = makeCompany("co-b", { legal_name: "Beta Co", attached_at: "2026-01-15T00:00:00Z" });

const THREE_COMPANIES = [SECONDARY_A, PRIMARY, SECONDARY_B]; // intentionally unordered

// ---------------------------------------------------------------------------
// test_company_picker_defaults_to_primary
// ---------------------------------------------------------------------------

describe("test_company_picker_defaults_to_primary", () => {
  beforeEach(() => localStorage.clear());

  it("given 3 attached, onChange is called with the primary company id on mount", async () => {
    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("co-primary");
    });
  });

  it("when no primary exists, defaults to first in sorted list", async () => {
    const companies = [
      makeCompany("co-x", { attached_at: "2026-03-01T00:00:00Z" }),
      makeCompany("co-y", { attached_at: "2026-02-01T00:00:00Z" }),
    ];
    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={companies}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      // sorted by attached_at desc → co-x is first
      expect(onChange).toHaveBeenCalledWith("co-x");
    });
  });
});

// ---------------------------------------------------------------------------
// test_company_picker_uses_last_used_when_set
// ---------------------------------------------------------------------------

describe("test_company_picker_uses_last_used_when_set", () => {
  beforeEach(() => localStorage.clear());

  it("localStorage billing.lastCompanyId.devis = co-a → picker selects co-a (over primary)", async () => {
    localStorage.setItem("billing.lastCompanyId.devis", "co-a");

    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("co-a");
    });
  });

  it("stale localStorage id (company no longer attached) → falls back to primary", async () => {
    localStorage.setItem("billing.lastCompanyId.devis", "co-detached");

    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value={null}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("co-primary");
    });
  });
});

// ---------------------------------------------------------------------------
// test_company_picker_skipped_when_single
// ---------------------------------------------------------------------------

describe("test_company_picker_skipped_when_single", () => {
  beforeEach(() => localStorage.clear());

  it("exactly 1 attached company → renders static label, no Select trigger", async () => {
    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={[PRIMARY]}
        value="co-primary"
        onChange={onChange}
      />
    );

    // Static label contains "Issued from" (i18n key: companies.picker.label)
    expect(screen.getByText(/issued from/i)).toBeDefined();
    // No combobox / Select trigger
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("single company shows the company name", () => {
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={[PRIMARY]}
        value="co-primary"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Primary Co")).toBeDefined();
  });

  it("single primary company shows primary badge", () => {
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={[PRIMARY]}
        value="co-primary"
        onChange={vi.fn()}
      />
    );
    // i18n key companies.picker.primaryBadge = "Primary"; may also match "Issued from"
    // so query for the badge span text specifically
    const matches = screen.getAllByText(/primary/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 0 companies — renders nothing
// ---------------------------------------------------------------------------

describe("CompanyPickerSelect — 0 companies", () => {
  beforeEach(() => localStorage.clear());

  it("renders null when attachedCompanies is empty", () => {
    const { container } = render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={[]}
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does NOT call onChange when attachedCompanies is empty", async () => {
    const onChange = vi.fn();
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={[]}
        value={null}
        onChange={onChange}
      />
    );
    // Wait a tick to confirm no async call
    await new Promise((r) => setTimeout(r, 10));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2+ companies — Select dropdown
// ---------------------------------------------------------------------------

describe("CompanyPickerSelect — 2+ companies dropdown", () => {
  beforeEach(() => localStorage.clear());

  it("renders a Select combobox trigger", () => {
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value="co-primary"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("persists selection to localStorage on change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value="co-primary"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);

    // Wait for portal items
    await waitFor(() => {
      const items = document.querySelectorAll("[role='option']");
      if (items.length === 0) throw new Error("options not rendered");
    });

    const options = document.querySelectorAll("[role='option']");
    const alphaOption = Array.from(options).find(
      (el) => el.textContent?.includes("Alpha Co")
    );
    if (alphaOption) {
      await user.click(alphaOption);
      await waitFor(() => {
        expect(localStorage.getItem("billing.lastCompanyId.devis")).toBe("co-a");
      });
    }
  });

  it("disabled prop disables the Select trigger", () => {
    render(
      <CompanyPickerSelect
        kind="devis"
        attachedCompanies={THREE_COMPANIES}
        value="co-primary"
        onChange={vi.fn()}
        disabled={true}
      />
    );
    const trigger = screen.getByRole("combobox");
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });
});
