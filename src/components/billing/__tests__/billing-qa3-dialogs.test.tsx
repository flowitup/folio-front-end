/**
 * QA round 3: "Depuis un modèle" with no template offers to create one in the
 * issuer company (sweep-new-company-journey-20), and "Depuis un existant"
 * searches and pages through every document (sweep-stale-pickers-14).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplyTemplateDialog } from "@/components/billing/apply-template-dialog";
import { CreateFromExistingDialog } from "@/components/billing/create-from-existing-dialog";
import type { BillingDocument } from "@/types/billing";

vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  listBillingTemplatesAction: vi.fn(),
  createBillingDocumentFromTemplateAction: vi.fn(),
  listBillingDocumentsAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return (path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string) ?? path;
  }
  const makeT = (ns: string) => {
    const t = (key: string, params?: Record<string, unknown>) =>
      Object.entries(params ?? {}).reduce(
        (text, [k, v]) => (typeof v === "function" ? text : text.replace(`{${k}}`, String(v))),
        resolve(en, `${ns}.${key}`)
      );
    t.rich = (key: string, params?: Record<string, unknown>) => t(key, params).replace(/<\/?\w+>/g, "");
    t.has = (key: string) => typeof resolve(en, `${ns}.${key}`) === "string";
    return t;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import {
  listBillingTemplatesAction,
  listBillingDocumentsAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const mockTemplates = vi.mocked(listBillingTemplatesAction);
const mockDocuments = vi.mocked(listBillingDocumentsAction);
const mockRouterPush = vi.fn();

function doc(id: string, kind: "devis" | "facture", issue_date: string): BillingDocument {
  return {
    id,
    kind,
    document_number: `DOC-${id}`,
    status: "draft",
    issue_date,
    recipient_name: `Client ${id}`,
    items: [],
    total_ht: "100",
    total_tva: "20",
    total_ttc: "120",
  } as unknown as BillingDocument;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApplyTemplateDialog — no template yet", () => {
  it("links to a new template in the issuer company", async () => {
    mockTemplates.mockResolvedValue({ ok: true, data: [] });
    const onOpenChange = vi.fn();
    render(<ApplyTemplateDialog open onOpenChange={onOpenChange} kind="devis" companyId="co-2" />);
    fireEvent.click(await screen.findByRole("button", { name: "Create a template" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockRouterPush).toHaveBeenCalledWith("/en/billing/templates/new?company_id=co-2");
  });
});

describe("CreateFromExistingDialog — search and paging", () => {
  it("sends the search to the API for both kinds", async () => {
    mockDocuments.mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    render(<CreateFromExistingDialog open onOpenChange={vi.fn()} kind="devis" />);
    await waitFor(() => expect(mockDocuments).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ancien" } });
    await waitFor(() =>
      expect(mockDocuments).toHaveBeenCalledWith("devis", 25, { offset: 0, q: "ancien" })
    );
    expect(mockDocuments).toHaveBeenCalledWith("facture", 25, { offset: 0, q: "ancien" });
    expect(await screen.findByText("No document matches this search.")).toBeDefined();
  });

  it("loads the next page of the kind that has more", async () => {
    mockDocuments.mockImplementation(async (kind, _limit, options) => {
      if (kind === "facture") return { ok: true, data: { items: [], total: 0 } };
      return options?.offset
        ? { ok: true, data: { items: [doc("old", "devis", "2026-03-02")], total: 2 } }
        : { ok: true, data: { items: [doc("new", "devis", "2026-03-27")], total: 2 } };
    });
    render(<CreateFromExistingDialog open onOpenChange={vi.fn()} kind="devis" />);
    await screen.findByText("DOC-new");
    fireEvent.click(screen.getByRole("button", { name: "Show more documents" }));
    await screen.findByText("DOC-old");
    expect(mockDocuments).toHaveBeenLastCalledWith("devis", 25, { offset: 1, q: "" });
    expect(screen.queryByRole("button", { name: "Show more documents" })).toBeNull();
  });
});
