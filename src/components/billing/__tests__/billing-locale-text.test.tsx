/**
 * Billing text in the user's language, with the real messages:
 * - VAT rates use the locale's number format ("5,5 %" in French, never "5.5%"
 *   or the API's "10.00%"): totals card, line editor, template cards and the
 *   apply-template dialog (which used to be hard-coded English);
 * - the templates header has its own subtitle, not the empty state's
 *   "create your first template";
 * - a failed action shows translated text, never the API's English message,
 *   and deleting a document already gone refreshes the list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { BillingTotalsCard, computeTotals } from "@/components/billing/billing-totals-card";
import { BillingDocumentItemsEditor } from "@/components/billing/billing-document-items-editor";
import { BillingTemplatesList } from "@/components/billing/billing-templates-list";
import { ApplyTemplateDialog } from "@/components/billing/apply-template-dialog";
import { BillingActionsMenu } from "@/components/billing/billing-actions-menu";
import type { BillingDocument, BillingDocumentItem, BillingDocumentTemplate } from "@/types/billing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  getActivitySuggestionsAction: vi.fn().mockResolvedValue({ ok: true, data: { categories: [], suggestions: [] } }),
  deleteBillingTemplateAction: vi.fn(),
  listBillingTemplatesAction: vi.fn(),
  createBillingDocumentFromTemplateAction: vi.fn(),
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  listBillingTemplatesAction,
  deleteBillingDocumentAction,
  convertDevisToFactureAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { toast } from "sonner";

const MESSAGES = { en: enMessages, fr: frMessages, vi: viMessages };

function renderIn(locale: keyof typeof MESSAGES, ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {ui}
    </NextIntlClientProvider>
  );
}

const ITEMS: BillingDocumentItem[] = [
  { description: "Peinture", quantity: "1", unit_price: "100", vat_rate: "20" },
  { description: "Isolation", quantity: "1", unit_price: "100", vat_rate: "5.50" },
];

function template(overrides: Partial<BillingDocumentTemplate> = {}): BillingDocumentTemplate {
  return {
    id: "tpl-1",
    user_id: "user-1",
    kind: "devis",
    name: "Rénovation",
    notes: null,
    terms: null,
    default_vat_rate: "10.00",
    items: [{ description: "Peinture", quantity: "1", unit_price: "100", vat_rate: "10.00" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("VAT rates in the user's language", () => {
  it("totals card: 'TVA 5,5 %' in French, 'VAT 5,5%' in Vietnamese, 'VAT 5.5%' in English", () => {
    const totals = computeTotals(ITEMS);
    const { unmount } = renderIn("fr", <BillingTotalsCard totals={totals} />);
    expect(screen.getByText(/^TVA 5,5\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^TVA 20\s%$/)).toBeInTheDocument();
    unmount();

    const inVi = renderIn("vi", <BillingTotalsCard totals={totals} />);
    expect(screen.getByText("VAT 5,5%")).toBeInTheDocument();
    inVi.unmount();

    renderIn("en", <BillingTotalsCard totals={totals} />);
    expect(screen.getByText("VAT 5.5%")).toBeInTheDocument();
    expect(screen.getByText("Subtotal (excl. VAT)")).toBeInTheDocument();
    expect(screen.getByText("Total (incl. VAT)")).toBeInTheDocument();
  });

  it("line editor (read-only): the API's '5.50' reads '5,5 %' in French", () => {
    renderIn("fr", <BillingDocumentItemsEditor items={ITEMS} onChange={vi.fn()} readOnly showTotals={false} />);
    expect(screen.getAllByText(/^5,5\s%$/).length).toBeGreaterThan(0);
    expect(screen.queryByText("5.50%")).toBeNull();
  });

  it("line editor: the VAT select shows the rate in French format", () => {
    renderIn(
      "fr",
      <BillingDocumentItemsEditor items={[ITEMS[1]]} onChange={vi.fn()} showTotals={false} />
    );
    const selects = screen.getAllByRole("combobox", { name: "TVA %" });
    expect(selects[0]).toHaveTextContent(/^5,5\s%$/);
  });

  it("template card: 'TVA par défaut 10 %', not the API's '10.00%'", () => {
    renderIn("fr", <BillingTemplatesList initialTemplates={[template()]} />);
    expect(screen.getByText(/^TVA par défaut 10\s%$/)).toBeInTheDocument();
    expect(screen.queryByText(/10\.00/)).toBeNull();
  });

  it("apply-template dialog: the row is translated, with the formatted rate", async () => {
    vi.mocked(listBillingTemplatesAction).mockResolvedValue({ ok: true, data: [template()] });
    renderIn("fr", <ApplyTemplateDialog open onOpenChange={vi.fn()} kind="devis" />);
    expect(await screen.findByText(/^1 article · TVA par défaut 10\s%$/)).toBeInTheDocument();
    expect(screen.queryByText(/line item|default VAT/)).toBeNull();
  });

  it("apply-template dialog: Vietnamese row, no default VAT", async () => {
    vi.mocked(listBillingTemplatesAction).mockResolvedValue({
      ok: true,
      data: [template({ default_vat_rate: null, items: [] })],
    });
    renderIn("vi", <ApplyTemplateDialog open onOpenChange={vi.fn()} kind="devis" />);
    expect(await screen.findByText("không có mục")).toBeInTheDocument();
  });
});

describe("Templates page subtitle", () => {
  it("is a neutral subtitle when templates exist", () => {
    renderIn("fr", <BillingTemplatesList initialTemplates={[template()]} />);
    expect(screen.getByText(frMessages.billing.templates.list.subtitle)).toBeInTheDocument();
    expect(screen.queryByText(frMessages.billing.templates.list.empty.description)).toBeNull();
  });

  it("keeps the 'create your first template' text for the empty state only", () => {
    renderIn("fr", <BillingTemplatesList initialTemplates={[]} />);
    expect(screen.getAllByText(frMessages.billing.templates.list.empty.description)).toHaveLength(1);
  });
});

describe("Failed billing actions show translated text", () => {
  const DEVIS = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "devis",
    status: "accepted",
    document_number: "DEV-2026-007",
    converted_to_facture_id: null,
  } as unknown as BillingDocument;

  async function openMenuAndClick(label: string) {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: frMessages.billing.form.actions.openMenu }));
    await user.click(await screen.findByText(label));
    return user;
  }

  it("delete of a document already gone: French message and the list refreshes", async () => {
    vi.mocked(deleteBillingDocumentAction).mockResolvedValue({
      ok: false,
      error: { code: "not_found", message: "The requested resource was not found." },
    });
    const onMutated = vi.fn();
    renderIn("fr", <BillingActionsMenu document={DEVIS} onMutated={onMutated} />);
    const user = await openMenuAndClick(frMessages.billing.form.actions.delete);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: frMessages.billing.form.actions.delete }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Ce document n'existe plus. Il a peut-être été supprimé.")
    );
    expect(onMutated).toHaveBeenCalled();
  });

  it("convert of an already converted devis from the list: French message, not the API's", async () => {
    vi.mocked(convertDevisToFactureAction).mockResolvedValue({
      ok: false,
      error: { code: "conflict", message: "Devis 1111 was already converted to a facture" },
    });
    renderIn("fr", <BillingActionsMenu document={DEVIS} onMutated={vi.fn()} />);
    await openMenuAndClick(frMessages.billing.form.actions.convertToFacture);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(frMessages.billing.form.errors.alreadyConverted)
    );
  });

  it("any other failure falls back to the action's own translated message", async () => {
    vi.mocked(deleteBillingDocumentAction).mockResolvedValue({
      ok: false,
      error: { code: "generic", message: "boom" },
    });
    const onMutated = vi.fn();
    renderIn("vi", <BillingActionsMenu document={DEVIS} onMutated={onMutated} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: viMessages.billing.form.actions.openMenu }));
    await user.click(await screen.findByText(viMessages.billing.form.actions.delete));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: viMessages.billing.form.actions.delete }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(viMessages.billing.form.errors.deleteFailed));
    expect(onMutated).not.toHaveBeenCalled();
  });
});
