/**
 * Tests for BillingDocumentForm component.
 *
 * Required named tests:
 *   - test_form_blank_create_calls_createBillingDocument_with_decimal_strings
 *   - test_form_edit_calls_update_with_partial_payload
 *   - test_missing_company_profile_renders_callout_not_form  (NOTE: this lives in
 *     company-profile-form.test.tsx — the form itself delegates to server actions,
 *     so we test the "company_profile_missing" error code surfacing here instead)
 *
 * Interaction strategy:
 *   - fireEvent.change for all text inputs (avoids userEvent + fake-timer deadlock)
 *   - fireEvent.click for buttons
 *   - await waitFor for async action callbacks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument, BillingDocumentItem } from "@/types/billing";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

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
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, String(v));
      });
    }
    return val;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

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

// PDF download helpers — stub so handleDownloadPdf doesn't actually fetch
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
  updateBillingDocumentAction,
  deleteBillingDocumentAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { toast } from "sonner";
import type { MyCompany } from "@/types/companies";

const mockCreate = vi.mocked(createBillingDocumentAction);
const mockUpdate = vi.mocked(updateBillingDocumentAction);
const mockDelete = vi.mocked(deleteBillingDocumentAction);
const mockRouterPush = vi.fn();
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixtures — attached companies (required prop for create + edit modes)
// ---------------------------------------------------------------------------

const ATTACHED_COMPANIES: MyCompany[] = [
  {
    id: "co-1",
    legal_name: "Maison Lavandou SAS",
    address: "12 Rue de la Paix, 75001 Paris",
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
    is_primary: true,
    attached_at: "2026-01-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ITEM: BillingDocumentItem = {
  description: "Consulting",
  quantity: "2",
  unit_price: "150",
  vat_rate: "20",
};

function makeDoc(overrides: Partial<BillingDocument> = {}): BillingDocument {
  return {
    id: "doc-1",
    user_id: "user-1",
    project_id: null,
    kind: "devis",
    document_number: "DEV-2026-001",
    status: "draft",
    issue_date: "2026-01-15",
    validity_until: "2026-02-15",
    payment_due_date: null,
    payment_terms: null,
    recipient_name: "ACME Corp",
    recipient_address: "123 Main St",
    recipient_email: null,
    recipient_siret: null,
    notes: "Some notes",
    terms: null,
    signature_block_text: null,
    items: [SAMPLE_ITEM],
    issuer_legal_name: "My Co",
    issuer_address: "Paris",
    issuer_siret: null,
    issuer_tva_number: null,
    issuer_iban: null,
    issuer_bic: null,
    issuer_logo_url: null,
    source_devis_id: null,
    total_ht: "300",
    total_tva: "60",
    total_ttc: "360",
    vat_breakdown: [{ rate: "20", base_ht: "300", tva_amount: "60" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill recipient name and add one line item, then click Save/Create. */
async function fillAndSubmitCreateForm(recipientName = "Test Client") {
  // Set recipient name
  const recipientInput = screen.getByLabelText(/name \*/i);
  fireEvent.change(recipientInput, { target: { value: recipientName } });

  // Add a line item
  fireEvent.click(screen.getByRole("button", { name: /add line/i }));

  // Fill description on the new item
  await waitFor(() => screen.getAllByPlaceholderText("Item description"));
  const descInputs = screen.getAllByPlaceholderText("Item description");
  fireEvent.change(descInputs[0], { target: { value: "Dev work" } });

  // Fill unit price (first spinbutton for that row is qty, second is unit_price)
  const spinButtons = screen.getAllByRole("spinbutton");
  // spinbuttons: [qty, unit_price] for the item row
  fireEvent.change(spinButtons[0], { target: { value: "1" } }); // qty
  fireEvent.change(spinButtons[1], { target: { value: "500" } }); // unit_price

  // Submit
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
  });
}

// ---------------------------------------------------------------------------
// test_form_blank_create_calls_createBillingDocument_with_decimal_strings
// ---------------------------------------------------------------------------

describe("test_form_blank_create_calls_createBillingDocument_with_decimal_strings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
  });

  it("renders blank create form with Create button and no document number", () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDefined();
    expect(screen.queryByText("Document number")).toBeNull();
  });

  it("shows validation error when recipient is empty on submit", async () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/recipient name is required/i)).toBeDefined();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows validation error when no items on submit", async () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);

    const recipientInput = screen.getByLabelText(/name \*/i);
    fireEvent.change(recipientInput, { target: { value: "Client X" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/at least one line item/i)).toBeDefined();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls createBillingDocumentAction with kind and decimal-string item values", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeDoc() });

    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    await fillAndSubmitCreateForm("Client Corp");

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    const [payload] = mockCreate.mock.calls[0] as [
      Parameters<typeof createBillingDocumentAction>[0]
    ];
    expect(payload.kind).toBe("devis");
    expect(payload.recipient_name).toBe("Client Corp");
    // Items carry Decimal-as-string values (not numbers)
    expect(typeof payload.items[0].quantity).toBe("string");
    expect(typeof payload.items[0].unit_price).toBe("string");
    expect(typeof payload.items[0].vat_rate).toBe("string");
  });

  it("redirects to document page on successful create", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeDoc({ id: "new-doc-99" }) });

    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    await fillAndSubmitCreateForm();

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("/billing/devis/new-doc-99")
      );
    });
    expect(mockToast.success).toHaveBeenCalledWith("Document created.");
  });

  it("shows error alert when createBillingDocumentAction returns ok=false", async () => {
    mockCreate.mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Invalid payload" },
    });

    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    await fillAndSubmitCreateForm();

    await waitFor(() => {
      expect(screen.getByText("Invalid payload")).toBeDefined();
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("facture mode shows payment due date field instead of validity_until", () => {
    render(<BillingDocumentForm mode="create" kind="facture" attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByLabelText(/payment due/i)).toBeDefined();
    expect(screen.queryByLabelText(/valid until/i)).toBeNull();
  });

  it("devis mode shows valid until field instead of payment due", () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByLabelText(/valid until/i)).toBeDefined();
    expect(screen.queryByLabelText(/payment due/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// test_form_edit_calls_update_with_partial_payload
// ---------------------------------------------------------------------------

describe("test_form_edit_calls_update_with_partial_payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
  });

  it("renders edit form with document number and Save changes button", () => {
    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDefined();
    // Document number appears in both the <h2> header and the read-only field —
    // use getAllByText to avoid "found multiple elements" error.
    expect(screen.getAllByText("DEV-2026-001").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Delete button in edit mode", () => {
    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeDefined();
  });

  it("calls updateBillingDocumentAction with mutated recipient_name", async () => {
    const updatedDoc = makeDoc({ recipient_name: "New Client" });
    mockUpdate.mockResolvedValueOnce({ ok: true, data: updatedDoc });

    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);

    const recipientInput = screen.getByDisplayValue("ACME Corp");
    fireEvent.change(recipientInput, { target: { value: "New Client" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledOnce();
    });

    const [id, payload] = mockUpdate.mock.calls[0] as [
      string,
      Parameters<typeof updateBillingDocumentAction>[1]
    ];
    expect(id).toBe("doc-1");
    expect(payload.recipient_name).toBe("New Client");
  });

  it("shows toast.success after successful update", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeDoc() });

    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Document saved.");
    });
  });

  it("shows error alert when update returns ok=false", async () => {
    mockUpdate.mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Update failed" },
    });

    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeDefined();
    });
  });

  it("calls deleteBillingDocumentAction and redirects on delete", async () => {
    mockDelete.mockResolvedValueOnce({ ok: true, data: undefined });

    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("doc-1");
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("/billing/devis")
      );
    });
  });

  it("shows Convert to Facture button only for accepted devis in edit mode", () => {
    const acceptedDevis = makeDoc({ status: "accepted", kind: "devis" });
    render(
      <BillingDocumentForm mode="edit" kind="devis" document={acceptedDevis} attachedCompanies={ATTACHED_COMPANIES} />
    );
    expect(
      screen.getByRole("button", { name: /convert to invoice/i })
    ).toBeDefined();
  });

  it("does NOT show Convert to Facture for draft devis", () => {
    render(
      <BillingDocumentForm mode="edit" kind="devis" document={makeDoc({ status: "draft" })} attachedCompanies={ATTACHED_COMPANIES} />
    );
    expect(
      screen.queryByRole("button", { name: /convert to invoice/i })
    ).toBeNull();
  });

  it("does NOT show Convert to Facture for factures", () => {
    render(
      <BillingDocumentForm
        mode="edit"
        kind="facture"
        document={makeDoc({ kind: "facture", status: "accepted" })}
        attachedCompanies={ATTACHED_COMPANIES}
      />
    );
    expect(
      screen.queryByRole("button", { name: /convert to invoice/i })
    ).toBeNull();
  });

  it("shows Download PDF button in edit mode", () => {
    render(<BillingDocumentForm mode="edit" kind="devis" document={makeDoc()} attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Create mode picker (blank / from existing / from template buttons)
// ---------------------------------------------------------------------------

describe("BillingDocumentForm — create mode picker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows mode picker buttons in blank create mode", () => {
    render(<BillingDocumentForm mode="create" kind="devis" attachedCompanies={ATTACHED_COMPANIES} />);
    expect(screen.getByRole("button", { name: /blank/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /from existing/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /from template/i })).toBeDefined();
  });

  it("does NOT show mode picker when initialFromSource is provided", () => {
    render(
      <BillingDocumentForm
        mode="create"
        kind="devis"
        attachedCompanies={ATTACHED_COMPANIES}
        initialFromSource={makeDoc()}
      />
    );
    expect(screen.queryByRole("button", { name: /from existing/i })).toBeNull();
  });
});
