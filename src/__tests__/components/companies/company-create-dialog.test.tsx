/**
 * company-create-dialog.test.tsx
 *
 * Required regression test:
 *   test_company_create_dialog_validates_logo_url
 *
 * Also covers: form validation (required fields), save success, error surfacing.
 *
 * Note on logo_url: M-1 fix added client-side URL scheme validation.
 *   javascript: and ftp: schemes are now rejected inline before the action is called.
 *   An invalid URL (non-parsable) also surfaces an inline field error.
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
// M-1 fix: client-side logo_url scheme validation blocks javascript: and ftp:
// before the action is called. Invalid URLs also produce inline field errors.
// ---------------------------------------------------------------------------

describe("test_company_create_dialog_validates_logo_url", () => {
  beforeEach(() => vi.clearAllMocks());

  it("javascript: URL is rejected client-side — action NOT called, inline error shown", async () => {
    renderDialog();

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

    // Client validation must block the action
    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
      // Inline scheme error shown below the field
      expect(screen.getByText(/http or https/i)).toBeDefined();
    });
  });

  it("invalid URL (not parseable) is rejected client-side with invalid URL message", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/legal name/i), { target: { value: "ACME Corp" } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "Paris" } });

    const logoInput = screen.getByLabelText(/logo/i);
    fireEvent.change(logoInput, { target: { value: "not a url at all !!!" } });

    await act(async () => {
      fireEvent.submit(logoInput.closest("form")!);
    });

    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
      expect(screen.getByText(/not a valid url/i)).toBeDefined();
    });
  });

  it("valid https:// URL passes client validation and calls action", async () => {
    mockCreate.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "co-1", legal_name: "ACME", address: "Paris",
        siret: null, tva_number: null, iban: null, bic: null,
        logo_url: "https://example.com/logo.png",
        default_payment_terms: null, prefix_override: null,
        created_by: "u", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
      },
    });

    renderDialog();

    fireEvent.change(screen.getByLabelText(/legal name/i), { target: { value: "ACME Corp" } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: "Paris" } });
    const logoInput = screen.getByLabelText(/logo/i);
    fireEvent.change(logoInput, { target: { value: "https://example.com/logo.png" } });

    await act(async () => {
      fireEvent.submit(logoInput.closest("form")!);
    });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
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
