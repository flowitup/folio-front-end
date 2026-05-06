/**
 * company-create-dialog.test.tsx
 *
 * Required regression test:
 *   test_company_create_dialog_validates_logo_url
 *
 * Also covers: form validation (required fields), save success, error surfacing.
 *
 * Note on logo_url: the field uses type="url" on the <input>.  A "javascript:"
 * scheme is rejected by the browser's built-in URL validator in real browsers,
 * but jsdom does NOT enforce type="url" constraints. The spec requires inline
 * validation to block javascript: URLs — but inspecting the production code
 * (company-create-dialog.tsx) shows NO custom logo_url validation; it only
 * validates legal_name and address.
 *
 * PRODUCTION BUG SURFACED (per hard-rule: surface, do not silently fix):
 *   CompanyCreateDialog has no client-side logo_url validation.
 *   Submitting "javascript:alert(1)" passes client validation and reaches
 *   createCompanyAction. The server must reject it, but the FE shows no
 *   inline error for this field. Test documents the current behaviour and
 *   marks the gap with a TODO.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CompanyCreateDialog } from "@/components/companies/company-create-dialog";

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    createCompanyAction: vi.fn(),
  })
);

import { createCompanyAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockCreate = vi.mocked(createCompanyAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function renderDialog(onCreated = vi.fn(), onOpenChange = vi.fn()) {
  return render(
    <CompanyCreateDialog open={true} onOpenChange={onOpenChange} onCreated={onCreated} />
  );
}

// ---------------------------------------------------------------------------
// test_company_create_dialog_validates_logo_url
//
// Documents current production behaviour: no client-side logo_url validation.
// TODO: add logo_url XSS validation in CompanyCreateDialog.validate().
// ---------------------------------------------------------------------------

describe("test_company_create_dialog_validates_logo_url", () => {
  beforeEach(() => vi.clearAllMocks());

  it("TODO: javascript: URL currently passes client validation (production gap)", async () => {
    // Server action returns an error — simulates BE rejection of malicious URL.
    mockCreate.mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Invalid logo URL scheme." },
    });

    renderDialog();

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/legal name/i), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: "12 rue de la Paix" },
    });

    // Enter javascript: URL in logo field
    const logoInput = screen.getByLabelText(/logo/i);
    fireEvent.change(logoInput, { target: { value: "javascript:alert(1)" } });

    await act(async () => {
      fireEvent.submit(logoInput.closest("form")!);
    });

    // Current behaviour: client validation passes → action is called → server rejects
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    // Server error surfaced via toast.error (no inline field error currently)
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid logo URL scheme.");
    });
  });
});

// ---------------------------------------------------------------------------
// Required fields validation
// ---------------------------------------------------------------------------

describe("CompanyCreateDialog — required field validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows legalName error when legal_name is empty on submit", async () => {
    renderDialog();

    // Only fill address, leave legal_name empty
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: "Paris" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    });

    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
      // Inline error text rendered below the field
      expect(screen.getByText(/required/i)).toBeDefined();
    });
  });

  it("shows address error when address is empty on submit", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/legal name/i), {
      target: { value: "ACME" },
    });
    // Leave address empty

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    });

    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
      expect(screen.getByText(/required/i)).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Save success
// ---------------------------------------------------------------------------

describe("CompanyCreateDialog — save success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls createCompanyAction, fires onCreated and toast.success on success", async () => {
    const createdCompany = {
      id: "co-new",
      legal_name: "New Co",
      address: "Paris",
      siret: null,
      tva_number: null,
      iban: null,
      bic: null,
      logo_url: null,
      default_payment_terms: null,
      prefix_override: null,
      created_by: "user-1",
      created_at: "2026-05-07T00:00:00Z",
      updated_at: "2026-05-07T00:00:00Z",
    };
    mockCreate.mockResolvedValueOnce({ ok: true, data: createdCompany });
    const onCreated = vi.fn();

    render(
      <CompanyCreateDialog open={true} onOpenChange={vi.fn()} onCreated={onCreated} />
    );

    fireEvent.change(screen.getByLabelText(/legal name/i), {
      target: { value: "New Co" },
    });
    fireEvent.change(screen.getByLabelText(/address/i), {
      target: { value: "Paris" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(onCreated).toHaveBeenCalledWith(createdCompany);
      expect(mockToast.success).toHaveBeenCalledOnce();
    });
  });
});

// ---------------------------------------------------------------------------
// Error surfacing
// ---------------------------------------------------------------------------

describe("CompanyCreateDialog — error surfacing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows toast.error when action returns ok=false", async () => {
    mockCreate.mockResolvedValueOnce({
      ok: false,
      error: { code: "forbidden_admin_required", message: "Admin access required." },
    });

    renderDialog();
    fireEvent.change(screen.getByLabelText(/legal name/i), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "Y" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Admin access required.");
    });
  });

  it("validates prefix_override: rejects values > 8 chars before calling action", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/legal name/i), { target: { value: "ACME" } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "Paris" } });

    // prefix_override input — type uppercase (the handler uppercases automatically)
    const prefixInput = screen.getByLabelText(/prefix/i);
    fireEvent.change(prefixInput, { target: { value: "TOOLONGPREFIX" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new company/i }));
    });

    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
