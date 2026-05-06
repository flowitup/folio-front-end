/**
 * billing-document-form-with-picker.test.tsx
 *
 * Required regression tests:
 *   test_create_doc_threads_company_id
 *   test_company_no_longer_attached_409_resets_picker
 *
 * Tests the BillingDocumentForm in create mode with a picker to verify:
 *   - company_id from the picker reaches createBillingDocumentAction
 *   - 409 company_no_longer_attached resets the picker and calls fetchMyCompaniesAction
 *
 * Interaction strategy: fireEvent.change for text inputs (avoids userEvent+fake-timer
 * deadlock). localStorage cleared in beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
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
    if (typeof val !== "string") return key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => { val = val.replace(`{${k}}`, String(v)); });
    }
    return val;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  },
}));

vi.mock(
  "@/app/[locale]/(app)/billing/_actions/billing-actions",
  () => ({
    createBillingDocumentAction: vi.fn(),
    updateBillingDocumentAction: vi.fn(),
    deleteBillingDocumentAction: vi.fn(),
    convertDevisToFactureAction: vi.fn(),
  })
);

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    fetchMyCompaniesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  })
);

vi.mock("@/lib/api/http", () => ({
  getApiAccessToken: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/util/trigger-browser-download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

vi.mock("@/lib/api/_helpers/content-disposition", () => ({
  parseFilenameFromContentDisposition: vi.fn().mockReturnValue("doc.pdf"),
}));

import {
  createBillingDocumentAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { fetchMyCompaniesAction } from "@/app/[locale]/(app)/settings/_actions/companies-actions";
import { toast } from "sonner";

const mockCreate = vi.mocked(createBillingDocumentAction);
const mockFetchMyCompanies = vi.mocked(fetchMyCompaniesAction);
const mockRouterPush = vi.fn();
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCompany(id: string, isPrimary = false): MyCompany {
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
    is_primary: isPrimary,
    attached_at: "2026-01-01T00:00:00Z",
  };
}

const PRIMARY_COMPANY = makeCompany("co-primary", true);
const ONE_COMPANY = [PRIMARY_COMPANY];

function makeDoc(overrides = {}) {
  return {
    id: "doc-1",
    user_id: "user-1",
    project_id: null,
    kind: "devis" as const,
    document_number: "DEV-2026-001",
    status: "draft" as const,
    issue_date: "2026-01-15",
    validity_until: "2026-02-15",
    payment_due_date: null,
    payment_terms: null,
    recipient_name: "ACME",
    recipient_address: "Paris",
    recipient_email: null,
    recipient_siret: null,
    notes: null,
    terms: null,
    signature_block_text: null,
    items: [],
    issuer_legal_name: "My Co",
    issuer_address: "Lyon",
    issuer_siret: null,
    issuer_tva_number: null,
    issuer_iban: null,
    issuer_bic: null,
    issuer_logo_url: null,
    source_devis_id: null,
    total_ht: "0",
    total_tva: "0",
    total_ttc: "0",
    vat_breakdown: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: fill minimum required form fields and click Create
// ---------------------------------------------------------------------------

async function fillAndSubmit(recipientName = "Client Corp") {
  const recipientInput = screen.getByLabelText(/name \*/i);
  fireEvent.change(recipientInput, { target: { value: recipientName } });

  fireEvent.click(screen.getByRole("button", { name: /add line/i }));

  await waitFor(() => screen.getAllByPlaceholderText("Item description"));
  const descInputs = screen.getAllByPlaceholderText("Item description");
  fireEvent.change(descInputs[0], { target: { value: "Consulting" } });

  const spinButtons = screen.getAllByRole("spinbutton");
  fireEvent.change(spinButtons[0], { target: { value: "1" } });
  fireEvent.change(spinButtons[1], { target: { value: "100" } });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
  });
}

// ---------------------------------------------------------------------------
// test_create_doc_threads_company_id
// ---------------------------------------------------------------------------

describe("test_create_doc_threads_company_id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
    localStorage.clear();
  });

  it("form save calls createBillingDocumentAction with the picker's company_id", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeDoc() });

    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={ONE_COMPANY}
      />
    );

    // Wait for picker to resolve default (useEffect → onChange(co-primary))
    await waitFor(() => {
      expect(screen.getByText("Company co-primary")).toBeDefined();
    });

    await fillAndSubmit("Test Client");

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    const [payload] = mockCreate.mock.calls[0] as [Parameters<typeof createBillingDocumentAction>[0]];
    expect(payload.company_id).toBe("co-primary");
    expect(payload.recipient_name).toBe("Test Client");
  });
});

// ---------------------------------------------------------------------------
// test_company_no_longer_attached_409_resets_picker
// ---------------------------------------------------------------------------

describe("test_company_no_longer_attached_409_resets_picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
    localStorage.clear();
  });

  it("409 company_no_longer_attached → toast.error shown and fetchMyCompaniesAction called", async () => {
    mockCreate.mockResolvedValueOnce({
      ok: false,
      error: { code: "company_no_longer_attached", message: "Access revoked." },
    });

    // fetchMyCompaniesAction returns updated list (e.g. empty after detachment)
    mockFetchMyCompanies.mockResolvedValueOnce({ ok: true, data: [] });

    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={ONE_COMPANY}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Company co-primary")).toBeDefined();
    });

    await fillAndSubmit();

    await waitFor(() => {
      // Toast error shown about access revoked / company no longer attached
      expect(mockToast.error).toHaveBeenCalledOnce();
      // fetchMyCompaniesAction called to refresh list
      expect(mockFetchMyCompanies).toHaveBeenCalledOnce();
    });

    // Router.push should NOT have been called (no redirect on this error)
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
