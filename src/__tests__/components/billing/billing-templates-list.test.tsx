/**
 * BillingTemplatesList — the icon-only delete button on each card has a name.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingTemplatesList } from "@/components/billing/billing-templates-list";
import type { BillingDocumentTemplate } from "@/types/billing";

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  deleteBillingTemplateAction: vi.fn(),
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
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const val = resolve(`${ns}.${key}`);
    if (typeof val !== "string") return key;
    return val.replace(/\{(\w+)\}/g, (m, k: string) => (params && k in params ? String(params[k]) : m));
  };
  return { useLocale: () => "en", useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeTemplate(id: string, name: string, kind: "devis" | "facture"): BillingDocumentTemplate {
  return {
    id,
    user_id: "user-1",
    kind,
    name,
    notes: null,
    terms: null,
    default_vat_rate: "20",
    items: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("BillingTemplatesList — delete buttons", () => {
  it("names each card's trash button after its template", () => {
    render(
      <BillingTemplatesList
        initialTemplates={[makeTemplate("t1", "Kitchen", "devis"), makeTemplate("t2", "Bathroom", "facture")]}
      />
    );

    expect(screen.getByRole("button", { name: "Delete template “Kitchen”" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete template “Bathroom”" })).toBeInTheDocument();
  });
});
