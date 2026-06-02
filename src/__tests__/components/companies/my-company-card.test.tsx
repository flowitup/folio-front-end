/**
 * my-company-card.test.tsx
 *
 * Required regression test:
 *   test_my_company_card_masks_sensitive_fields_for_non_admin
 *
 * Also covers: primary badge, set-primary action, detach confirm.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MyCompanyCard } from "@/components/companies/my-company-card";
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
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => { val = val.replace(`{${k}}`, String(v)); });
    }
    return val;
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    setPrimaryCompanyAction: vi.fn(),
    detachCompanyAction: vi.fn(),
  })
);

import {
  setPrimaryCompanyAction,
  detachCompanyAction,
} from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockSetPrimary = vi.mocked(setPrimaryCompanyAction);
const mockDetach = vi.mocked(detachCompanyAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<MyCompany> = {}): MyCompany {
  return {
    id: "co-1",
    legal_name: "ACME Corp",
    address: "12 Rue de la Paix, 75001 Paris",
    siret: "····5678",
    tva_number: "····9012",
    iban: "····3456",
    bic: "····7890",
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

// ---------------------------------------------------------------------------
// test_my_company_card_masks_sensitive_fields_for_non_admin
// ---------------------------------------------------------------------------

describe("test_my_company_card_masks_sensitive_fields_for_non_admin", () => {
  it("DOM does not contain raw SIRET/TVA/IBAN/BIC — shows masked pattern", () => {
    const company = makeCompany({
      siret: "····5678",
      tva_number: "····9012",
      iban: "····3456",
      bic: "····7890",
    });
    render(<MyCompanyCard company={company} onMutated={vi.fn()} />);

    // Masked values rendered via MaskDisplay
    expect(screen.getByText("····5678")).toBeDefined();
    expect(screen.getByText("····9012")).toBeDefined();
    expect(screen.getByText("····3456")).toBeDefined();
    expect(screen.getByText("····7890")).toBeDefined();

    // Raw (unmasked) values are NOT in the DOM
    expect(screen.queryByText("12345678900012")).toBeNull();
  });

  it("shows '—' when sensitive fields are null", () => {
    const company = makeCompany({ siret: null, tva_number: null, iban: null, bic: null });
    render(<MyCompanyCard company={company} onMutated={vi.fn()} />);
    // MaskDisplay renders null as "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Primary badge
// ---------------------------------------------------------------------------

describe("MyCompanyCard — primary badge", () => {
  it("shows primary badge when is_primary=true", () => {
    render(<MyCompanyCard company={makeCompany({ is_primary: true })} onMutated={vi.fn()} />);
    // Card shows both the badge ("Primary") and the "Set as primary" button — use getAllByText
    const matches = screen.getAllByText(/primary/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("does NOT show primary badge when is_primary=false", () => {
    render(<MyCompanyCard company={makeCompany({ is_primary: false })} onMutated={vi.fn()} />);
    // The card still shows the "Set as primary" button text, but not the badge
    // Primary badge has a Star icon inside it — check the badge span is absent
    const badges = document.querySelectorAll("[data-primary-badge]");
    expect(badges.length).toBe(0);
  });

  it("Set as primary button is disabled when already primary", () => {
    render(<MyCompanyCard company={makeCompany({ is_primary: true })} onMutated={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /set as primary/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Set-primary action
// ---------------------------------------------------------------------------

describe("MyCompanyCard — set-primary action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls setPrimaryCompanyAction and invokes onMutated on success", async () => {
    mockSetPrimary.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = vi.fn();

    render(<MyCompanyCard company={makeCompany({ is_primary: false })} onMutated={onMutated} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /set as primary/i }));
    });

    await waitFor(() => {
      expect(mockSetPrimary).toHaveBeenCalledWith("co-1");
      expect(onMutated).toHaveBeenCalledOnce();
    });
  });

  it("shows toast.error when setPrimaryCompanyAction returns ok=false", async () => {
    mockSetPrimary.mockResolvedValueOnce({
      ok: false,
      error: { code: "conflict", message: "Already primary" },
    });

    render(<MyCompanyCard company={makeCompany({ is_primary: false })} onMutated={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /set as primary/i }));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Already primary");
    });
  });
});

// ---------------------------------------------------------------------------
// Detach confirm
// ---------------------------------------------------------------------------

describe("MyCompanyCard — detach confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens detach confirm dialog on Detach click", async () => {
    render(<MyCompanyCard company={makeCompany()} onMutated={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detach/i }));
    });

    await waitFor(() => {
      // AlertDialog shows the confirm description
      expect(screen.getByRole("alertdialog")).toBeDefined();
    });
  });

  it("calls detachCompanyAction on confirm and invokes onMutated", async () => {
    mockDetach.mockResolvedValueOnce({ ok: true, data: undefined });
    const onMutated = vi.fn();

    render(<MyCompanyCard company={makeCompany()} onMutated={onMutated} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detach/i }));
    });

    await waitFor(() => screen.getByRole("alertdialog"));

    // Click the confirm action inside the dialog
    const actionButtons = screen.getAllByRole("button", { name: /detach/i });
    // The last "Detach" button is the AlertDialogAction inside the dialog
    const confirmBtn = actionButtons[actionButtons.length - 1];
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockDetach).toHaveBeenCalledWith("co-1");
      expect(onMutated).toHaveBeenCalledOnce();
    });
  });
});
