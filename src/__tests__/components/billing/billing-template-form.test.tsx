/**
 * BillingTemplateForm — the save payload matches the template request schema.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BillingTemplateForm } from "@/components/billing/billing-template-form";
import type { BillingDocumentItem, BillingDocumentTemplate } from "@/types/billing";

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  createBillingTemplateAction: vi.fn(),
  updateBillingTemplateAction: vi.fn(),
  deleteBillingTemplateAction: vi.fn(),
  getActivitySuggestionsAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { categories: [], suggestions: [] },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  const resolve = (path: string): unknown =>
    path.split(".").reduce<unknown>(
      (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
      en
    );
  const makeT = (ns: string) => {
    const t = (key: string) => {
      const val = resolve(`${ns}.${key}`);
      return typeof val === "string" ? val : key;
    };
    t.rich = (key: string) => t(key).replace(/<\/?\w+>/g, "");
    return t;
  };
  return { useLocale: () => "en", useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { updateBillingTemplateAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockUpdate = vi.mocked(updateBillingTemplateAction);

const TEMPLATE: BillingDocumentTemplate = {
  id: "tpl-1",
  user_id: "user-1",
  kind: "devis",
  name: "Kitchen",
  notes: null,
  terms: null,
  default_vat_rate: "20",
  items: [
    {
      description: "Pose",
      quantity: "2.000",
      unit_price: "150.00",
      vat_rate: "20.00",
      category: null,
      total_ht: "300.000",
      total_tva: "60.000",
      total_ttc: "360.000",
    } as BillingDocumentItem,
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("BillingTemplateForm — save payload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves an existing template without the computed line totals", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: TEMPLATE });
    render(<BillingTemplateForm mode="edit" template={TEMPLATE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledOnce());
    const payload = mockUpdate.mock.calls[0][1];
    expect(Object.keys(payload.items![0]).sort()).toEqual([
      "category",
      "description",
      "quantity",
      "unit_price",
      "vat_rate",
    ]);
  });
});

describe("BillingTemplateForm — default VAT rate", () => {
  it("shows a saved '10.00' default as the 10% preset, not as a custom value", () => {
    render(<BillingTemplateForm mode="edit" template={{ ...TEMPLATE, default_vat_rate: "10.00" }} />);

    expect(screen.queryByPlaceholderText("e.g. 8.5")).toBeNull();
  });

  it("labels the create button Create", () => {
    render(<BillingTemplateForm mode="create" />);

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});


describe("BillingTemplateForm — notes and terms caps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caps notes and terms at 2000 characters, like a document", () => {
    render(<BillingTemplateForm mode="edit" template={TEMPLATE} />);
    expect(document.getElementById("tpl-notes")?.getAttribute("maxlength")).toBe("2000");
    expect(document.getElementById("tpl-terms")?.getAttribute("maxlength")).toBe("2000");
  });

  it("refuses to save notes longer than a document accepts", async () => {
    render(<BillingTemplateForm mode="edit" template={{ ...TEMPLATE, notes: "n".repeat(2990) }} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    // This file's t() mock does not interpolate: the message is the textTooLong key's text.
    expect(await screen.findByText(/characters or fewer/)).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("BillingTemplateForm — header and delete dialog", () => {
  it("names the icon-only back button", () => {
    render(<BillingTemplateForm mode="create" />);

    expect(screen.getByRole("button", { name: "Back to templates" })).toBeInTheDocument();
  });

  it("titles the delete confirmation as a delete question, not as the page title", async () => {
    render(<BillingTemplateForm mode="edit" template={TEMPLATE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
    });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Delete template?");
  });
});
