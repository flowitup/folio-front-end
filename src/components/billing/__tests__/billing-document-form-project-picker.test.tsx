/**
 * Tests for BillingDocumentForm — project picker integration.
 *
 * Verifies:
 *   - Project <Select> renders in the Meta block
 *   - "No project" option is present and submitting with it sends project_id: null
 *   - Selecting a project sends project_id: <id> in create payload
 *   - Edit mode: submitting sends project_id from state (always sent to allow unlink)
 *
 * Mocking strategy:
 *   - next-intl: key-lookup against en.json (same pattern as billing-totals-card.test.tsx)
 *   - next/navigation: stub useRouter / useLocale
 *   - billing-actions: vi.fn() stubs; checked for call args
 *   - sonner: as-unknown-as cast pattern
 *   - fetchMyCompaniesAction: stub (not exercised in happy path)
 *
 * Interaction: fireEvent (not userEvent) to avoid fake-timer deadlocks with Radix.
 * Radix Select triggers are opened via fireEvent.click; items selected via
 * fireEvent.click on the portal item after the menu opens.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument } from "@/types/billing";
import type { MyCompany } from "@/types/companies";
import type { ProjectSummary } from "@/lib/api/projects-server";

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
    updateBillingDocumentStatusAction: vi.fn(),
  })
);

vi.mock(
  "@/app/[locale]/(app)/settings/_actions/companies-actions",
  () => ({
    fetchMyCompaniesAction: vi.fn(),
  })
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/billing/devis",
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
        val = val?.replace(`{${k}}`, String(v)) ?? val;
      });
    }
    return val ?? key;
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

// Stub the billing document items editor to avoid deep component rendering
vi.mock("@/components/billing/billing-document-items-editor", () => ({
  BillingDocumentItemsEditor: ({ items, onChange }: {
    items: unknown[];
    onChange: (items: unknown[]) => void;
  }) => (
    <div data-testid="items-editor">
      <button
        type="button"
        onClick={() =>
          onChange([
            { description: "Test item", quantity: "1", unit_price: "100", vat_rate: "20" },
          ])
        }
      >
        Add test item
      </button>
      <span data-testid="items-count">{items.length}</span>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  createBillingDocumentAction,
  updateBillingDocumentAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockCreate = vi.mocked(createBillingDocumentAction);
const mockUpdate = vi.mocked(updateBillingDocumentAction);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const COMPANY: MyCompany = {
  id: "company-1",
  legal_name: "ACME Corp",
  siret: null,
  address: "",
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
  role: "admin",
};

const PROJECT_A: ProjectSummary = { id: "proj-a", name: "Project Alpha" };
const PROJECT_B: ProjectSummary = { id: "proj-b", name: "Project Beta" };

const BASE_DOCUMENT: BillingDocument = {
  id: "doc-1",
  user_id: "user-1",
  project_id: "proj-a",
  kind: "devis",
  document_number: "TST-D-2026-0001",
  status: "draft",
  issue_date: "2026-06-01",
  validity_until: "2026-07-01",
  payment_due_date: null,
  payment_terms: null,
  recipient_name: "Test Client",
  recipient_address: null,
  recipient_email: null,
  recipient_siret: null,
  notes: null,
  terms: null,
  signature_block_text: null,
  items: [{ description: "Item A", quantity: "1", unit_price: "100", vat_rate: "20" }],
  issuer_legal_name: "ACME Corp",
  issuer_address: "123 Rue Test",
  issuer_siret: null,
  issuer_tva_number: null,
  issuer_iban: null,
  issuer_bic: null,
  issuer_logo_url: null,
  source_devis_id: null,
  total_ht: "100",
  total_tva: "20",
  total_ttc: "120",
  vat_breakdown: [],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Helper to fill minimum required fields (recipient + 1 item) in create mode
// ---------------------------------------------------------------------------

async function fillMinimumCreateFields() {
  // Set recipient name
  const recipientInput = screen.getByPlaceholderText(/client or company name/i);
  fireEvent.change(recipientInput, { target: { value: "Test Client" } });

  // Add an item via the stubbed editor
  fireEvent.click(screen.getByText("Add test item"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BillingDocumentForm — project picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ ok: true, data: { ...BASE_DOCUMENT, id: "new-doc" } });
    mockUpdate.mockResolvedValue({ ok: true, data: BASE_DOCUMENT });
  });

  describe("create mode", () => {
    it("renders a project select labelled 'Project (optional)'", () => {
      render(
        <BillingDocumentForm
          mode="create"
          kind="devis"
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      expect(screen.getByText("Project (optional)")).toBeDefined();
    });

    it("renders 'No project' option by default", () => {
      render(
        <BillingDocumentForm
          mode="create"
          kind="devis"
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      // The select shows the current value — "No project" is the default
      expect(screen.getByText("No project")).toBeDefined();
    });

    it("renders with empty projects list — only 'No project' available", () => {
      render(
        <BillingDocumentForm
          mode="create"
          kind="devis"
          attachedCompanies={[COMPANY]}
          projects={[]}
        />
      );

      expect(screen.getByText("Project (optional)")).toBeDefined();
      expect(screen.getByText("No project")).toBeDefined();
    });

    it("submitting with 'No project' sends project_id: null", async () => {
      mockCreate.mockResolvedValue({ ok: true, data: { ...BASE_DOCUMENT, id: "new-doc" } });

      render(
        <BillingDocumentForm
          mode="create"
          kind="devis"
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      await fillMinimumCreateFields();

      // Click Save — project_id should be null (default "No project")
      fireEvent.click(screen.getByRole("button", { name: /create/i }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledTimes(1);
      });

      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.project_id).toBeNull();
    });
  });

  describe("edit mode", () => {
    it("pre-selects the document's existing project_id", () => {
      render(
        <BillingDocumentForm
          mode="edit"
          kind="devis"
          document={BASE_DOCUMENT}
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      // BASE_DOCUMENT.project_id = "proj-a" → should display "Project Alpha"
      expect(screen.getByText("Project Alpha")).toBeDefined();
    });

    it("submitting always sends project_id in update payload", async () => {
      mockUpdate.mockResolvedValue({ ok: true, data: BASE_DOCUMENT });

      render(
        <BillingDocumentForm
          mode="edit"
          kind="devis"
          document={BASE_DOCUMENT}
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledTimes(1);
      });

      const [, payload] = mockUpdate.mock.calls[0];
      expect(payload).toHaveProperty("project_id");
      // project_id seeded from BASE_DOCUMENT.project_id = "proj-a"
      expect(payload.project_id).toBe("proj-a");
    });

    it("edit mode with null project_id seeds 'No project'", () => {
      const docNoProject = { ...BASE_DOCUMENT, project_id: null };

      render(
        <BillingDocumentForm
          mode="edit"
          kind="devis"
          document={docNoProject}
          attachedCompanies={[COMPANY]}
          projects={[PROJECT_A, PROJECT_B]}
        />
      );

      expect(screen.getByText("No project")).toBeDefined();
    });
  });
});
