/**
 * BillingTemplatesList — "Updated today / yesterday" counts the viewer's
 * calendar days, not 24 h periods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function makeTemplate(updatedAt: string): BillingDocumentTemplate {
  return {
    id: "t1",
    user_id: "user-1",
    kind: "devis",
    name: "Kitchen",
    notes: null,
    terms: null,
    default_vat_rate: "20",
    items: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: updatedAt,
  };
}

describe("BillingTemplatesList — last updated", () => {
  const savedTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Paris";
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it("says 'yesterday' at 05:00 for a template saved at 19:03 the evening before", () => {
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z")); // 10 Oct 05:00 Paris
    // The API's RFC 1123 timestamp: 9 Oct 19:03 Paris.
    render(<BillingTemplatesList initialTemplates={[makeTemplate("Fri, 09 Oct 2026 17:03:47 GMT")]} />);
    expect(screen.getByText("Updated yesterday")).toBeInTheDocument();
  });

  it("says 'today' late in the evening for a template saved that morning", () => {
    vi.setSystemTime(new Date("2026-10-09T20:30:00Z")); // 9 Oct 22:30 Paris
    render(<BillingTemplatesList initialTemplates={[makeTemplate("Fri, 09 Oct 2026 06:00:00 GMT")]} />);
    expect(screen.getByText("Updated today")).toBeInTheDocument();
  });
});
