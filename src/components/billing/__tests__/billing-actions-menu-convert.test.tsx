/**
 * A converted devis links to its facture instead of offering the conversion
 * again, and converting from the list opens the new facture.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BillingActionsMenu } from "../billing-actions-menu";
import type { BillingDocument } from "@/types/billing";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/[locale]/(app)/billing/_actions/billing-actions", () => ({
  deleteBillingDocumentAction: vi.fn(),
  convertDevisToFactureAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { convertDevisToFactureAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";

const DEVIS = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "devis",
  status: "accepted",
  document_number: "DEV-2026-079",
  converted_to_facture_id: null,
} as unknown as BillingDocument;

function renderMenu(doc: BillingDocument, onMutated = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BillingActionsMenu document={doc} onMutated={onMutated} />
    </NextIntlClientProvider>,
  );
  return onMutated;
}

beforeEach(() => vi.clearAllMocks());

describe("BillingActionsMenu conversion", () => {
  it("offers Open invoice, not Convert, once the devis is converted", async () => {
    const user = userEvent.setup();
    renderMenu({ ...DEVIS, converted_to_facture_id: "22222222-2222-4222-8222-222222222222" });
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Convert to Invoice")).toBeNull();
    await user.click(await screen.findByText("Open invoice"));
    expect(push).toHaveBeenCalledWith("/en/billing/factures/22222222-2222-4222-8222-222222222222");
  });

  it("opens the new facture after converting from the list", async () => {
    const user = userEvent.setup();
    vi.mocked(convertDevisToFactureAction).mockResolvedValue({
      ok: true,
      data: { id: "33333333-3333-4333-8333-333333333333" },
    } as never);
    const onMutated = renderMenu(DEVIS);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Convert to Invoice"));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/en/billing/factures/33333333-3333-4333-8333-333333333333"),
    );
    expect(onMutated).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
