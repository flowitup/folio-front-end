/**
 * Tests for ApplyTemplateDialog component.
 *
 * Required named test: test_apply_template_dialog_lists_filtered_by_kind_and_creates_doc
 *
 * Interaction strategy: fireEvent.change for inputs (avoids fake-timer conflicts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplyTemplateDialog } from "@/components/billing/apply-template-dialog";
import type { BillingDocumentTemplate, BillingDocument } from "@/types/billing";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock(
  "@/app/[locale]/(app)/billing/_actions/billing-actions",
  () => ({
    listBillingTemplatesAction: vi.fn(),
    createBillingDocumentFromTemplateAction: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
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

import {
  listBillingTemplatesAction,
  createBillingDocumentFromTemplateAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { toast } from "sonner";

const mockListAction = vi.mocked(listBillingTemplatesAction);
const mockCreateAction = vi.mocked(createBillingDocumentFromTemplateAction);
const mockRouterPush = vi.fn();
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEVIS_TEMPLATE: BillingDocumentTemplate = {
  id: "tpl-devis-1",
  user_id: "user-1",
  kind: "devis",
  name: "Standard Consulting Devis",
  notes: "Some notes",
  terms: "Payment net 30",
  default_vat_rate: "20",
  items: [
    { description: "Consulting", quantity: "1", unit_price: "500", vat_rate: "20" },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const FACTURE_TEMPLATE: BillingDocumentTemplate = {
  ...DEVIS_TEMPLATE,
  id: "tpl-facture-1",
  kind: "facture",
  name: "Standard Facture",
};

function makeCreatedDoc(kind: "devis" | "facture"): BillingDocument {
  return {
    id: "new-doc-1",
    user_id: "user-1",
    project_id: null,
    kind,
    document_number: "DOC-001",
    status: "draft",
    issue_date: "2026-01-01",
    validity_until: null,
    payment_due_date: null,
    payment_terms: null,
    recipient_name: "Client X",
    recipient_address: null,
    recipient_email: null,
    recipient_siret: null,
    notes: null,
    terms: null,
    signature_block_text: null,
    items: [],
    issuer_legal_name: "My Co",
    issuer_address: "Paris",
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
  };
}

function renderDialog(
  kind: "devis" | "facture" = "devis",
  open = true,
  onOpenChange = vi.fn()
) {
  return render(
    <ApplyTemplateDialog open={open} onOpenChange={onOpenChange} kind={kind} />
  );
}

// ---------------------------------------------------------------------------
// test_apply_template_dialog_lists_filtered_by_kind_and_creates_doc
// ---------------------------------------------------------------------------

describe("test_apply_template_dialog_lists_filtered_by_kind_and_creates_doc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterPush.mockReset();
  });

  it("calls listBillingTemplatesAction with the correct kind filter", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });

    renderDialog("devis");

    await waitFor(() => {
      expect(mockListAction).toHaveBeenCalledWith("devis");
    });
  });

  it("lists templates filtered by kind=devis", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });

    renderDialog("devis");

    await waitFor(() => {
      expect(screen.getByText("Standard Consulting Devis")).toBeDefined();
    });
  });

  it("lists templates filtered by kind=facture", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [FACTURE_TEMPLATE] });

    renderDialog("facture");

    await waitFor(() => {
      expect(screen.getByText("Standard Facture")).toBeDefined();
    });
  });

  it("shows 'No <kind> templates saved yet' when list is empty", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [] });

    renderDialog("devis");

    await waitFor(() => {
      expect(screen.getByText(/no devis templates saved yet/i)).toBeDefined();
    });
  });

  it("shows load error when action fails", async () => {
    mockListAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "generic", message: "Server unavailable" },
    });

    renderDialog("devis");

    await waitFor(() => {
      expect(screen.getByText("Server unavailable")).toBeDefined();
    });
  });

  it("shows recipient fields after selecting a template", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });

    renderDialog("devis");
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    fireEvent.click(screen.getByText("Standard Consulting Devis"));

    await waitFor(() => {
      expect(screen.getByLabelText(/name \*/i)).toBeDefined();
    });
  });

  it("shows name validation error when submitting without recipient name", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });

    renderDialog("devis");
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    // Select template
    fireEvent.click(screen.getByText("Standard Consulting Devis"));
    await waitFor(() => screen.getByLabelText(/name \*/i));

    // Submit without filling name
    fireEvent.click(screen.getByRole("button", { name: /create from template/i }));

    await waitFor(() => {
      expect(screen.getByText(/recipient name is required/i)).toBeDefined();
    });
    expect(mockCreateAction).not.toHaveBeenCalled();
  });

  it("calls createBillingDocumentFromTemplateAction with recipient payload on valid submit", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });
    mockCreateAction.mockResolvedValueOnce({
      ok: true,
      data: makeCreatedDoc("devis"),
    });

    renderDialog("devis");
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    fireEvent.click(screen.getByText("Standard Consulting Devis"));
    await waitFor(() => screen.getByLabelText(/name \*/i));

    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Client X" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create from template/i }));

    await waitFor(() => {
      expect(mockCreateAction).toHaveBeenCalledWith(
        "tpl-devis-1",
        expect.objectContaining({ recipient_name: "Client X" })
      );
    });
  });

  it("redirects to /billing/<kind>/<doc-id> on success", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });
    mockCreateAction.mockResolvedValueOnce({
      ok: true,
      data: makeCreatedDoc("devis"),
    });
    const onOpenChange = vi.fn();

    renderDialog("devis", true, onOpenChange);
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    fireEvent.click(screen.getByText("Standard Consulting Devis"));
    await waitFor(() => screen.getByLabelText(/name \*/i));
    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Client X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create from template/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockRouterPush).toHaveBeenCalledWith(
        expect.stringContaining("/billing/devis/new-doc-1")
      );
      expect(mockToast.success).toHaveBeenCalledWith("Document created from template.");
    });
  });

  it("shows error toast and keeps dialog open on create failure", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });
    mockCreateAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "generic", message: "Create failed" },
    });
    const onOpenChange = vi.fn();

    renderDialog("devis", true, onOpenChange);
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    fireEvent.click(screen.getByText("Standard Consulting Devis"));
    await waitFor(() => screen.getByLabelText(/name \*/i));
    fireEvent.change(screen.getByLabelText(/name \*/i), {
      target: { value: "Client X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create from template/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Create failed");
    });
    // Dialog stays open
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Cancel button closes dialog without creating", async () => {
    mockListAction.mockResolvedValueOnce({ ok: true, data: [DEVIS_TEMPLATE] });
    const onOpenChange = vi.fn();

    renderDialog("devis", true, onOpenChange);
    await waitFor(() => screen.getByText("Standard Consulting Devis"));

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockCreateAction).not.toHaveBeenCalled();
  });
});
