/** BillingDocumentForm — client validation and translated save errors (never the API's raw field-path text). */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { BillingDocument } from "@/types/billing";



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
  const makeT = (ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) => {
      let val = resolve(en, `${ns}.${key}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (typeof v !== "function") val = val?.replace(`{${k}}`, String(v)) ?? val;
        });
      }
      return val ?? key;
    };
    // Rich messages render as plain text here: tags are stripped, values interpolated.
    t.rich = (key: string, params?: Record<string, unknown>) =>
      t(key, params).replace(/<\/?\w+>/g, "");
    return t;
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

import { updateBillingDocumentAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockUpdate = vi.mocked(updateBillingDocumentAction);

const DOC = {
  id: "doc-1",
  user_id: "user-1",
  project_id: null,
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
  issuer_address: "1 Rue Test",
  source_devis_id: null,
  total_ht: "100",
  total_tva: "20",
  total_ttc: "120",
  vat_breakdown: [],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
} as unknown as BillingDocument;

function renderWith(overrides: Partial<BillingDocument>) {
  render(<BillingDocumentForm mode="edit" kind="devis" document={{ ...DOC, ...overrides }} attachedCompanies={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

const line = (patch: Record<string, string>) => [{ ...DOC.items[0], ...patch }];

describe("BillingDocumentForm validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{ items: line({ vat_rate: "150" }) }, "Item VAT rate cannot exceed 100%."],
    [{ items: line({ vat_rate: "" }) }, "Every item needs a VAT rate."],
    [{ items: line({ quantity: "10000000" }) }, "Item quantity cannot exceed 9999999."],
    [{ items: line({ unit_price: "1000000000" }) }, "Item unit price cannot exceed 999999999."],
    [{ recipient_email: "no-at-sign" }, "Enter a valid recipient email address."],
  ])("blocks %j before calling the API", async (overrides, message) => {
    renderWith(overrides as Partial<BillingDocument>);
    expect(await screen.findByText(message)).toBeDefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("translates an API validation error instead of showing its raw text", async () => {
    mockUpdate.mockResolvedValue({
      ok: false,
      error: { code: "validation", message: "items.0.vat_rate: Input should be a valid decimal" },
    });
    renderWith({});
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(
      await screen.findByText("Some fields are invalid. Check the dates, email and line amounts."),
    ).toBeDefined();
    expect(screen.queryByText(/Input should be/)).toBeNull();
  });
});
