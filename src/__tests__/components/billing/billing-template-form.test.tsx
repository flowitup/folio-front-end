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
