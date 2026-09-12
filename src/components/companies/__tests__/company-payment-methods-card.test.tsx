/**
 * Settings › Company → payment methods card.
 *
 * The company picker and the admin gate now live in CompanySettingsSection, so
 * this card's whole job is: fetch the methods for the company it was handed,
 * keep the section's chrome while that is in flight, and surface a failed fetch
 * instead of an empty list (which would read as "this company has no methods").
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { CompanyPaymentMethodsCard } from "../company-payment-methods-card";

const listPaymentMethodsAction = vi.fn();

vi.mock(
  "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions",
  () => ({
    listPaymentMethodsAction: (...args: unknown[]) => listPaymentMethodsAction(...args),
    createPaymentMethodAction: vi.fn(),
    updatePaymentMethodAction: vi.fn(),
    deletePaymentMethodAction: vi.fn(),
  })
);

const COMPANY_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_B = "22222222-2222-2222-2222-222222222222";

const METHOD = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  companyId: COMPANY_A,
  label: "Wise",
  isBuiltin: false,
  isActive: true,
  isCompanyPayment: false,
  isPersonalPayment: false,
  usageCount: 0,
};

function renderCard(companyId = COMPANY_A) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CompanyPaymentMethodsCard companyId={companyId} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  listPaymentMethodsAction.mockResolvedValue({ ok: true, data: [METHOD] });
});

describe("CompanyPaymentMethodsCard", () => {
  it("loads the handed company's methods and renders them", async () => {
    renderCard();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    expect(listPaymentMethodsAction).toHaveBeenCalledWith(COMPANY_A);
  });

  it("offers the add form — the card is only ever mounted for an admin", async () => {
    renderCard();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    expect(
      screen.getByRole("button", { name: enMessages.paymentMethods.addButton })
    ).toBeDefined();
  });

  it("holds the frame, without the section's controls, while the fetch is in flight", () => {
    listPaymentMethodsAction.mockReturnValue(new Promise(() => {}));
    renderCard();

    // Title and frame are up so the card keeps its place in the stack...
    expect(screen.getByText(enMessages.paymentMethods.title)).toBeDefined();
    // ...but nothing the loaded section owns has rendered yet.
    expect(screen.queryByText("Wise")).toBeNull();
    expect(screen.queryByPlaceholderText(/e\.g\./i)).toBeNull();
    expect(
      screen.queryByText(enMessages.paymentMethods.description)
    ).toBeNull();
  });

  it("shows the load error instead of an empty list when the fetch fails", async () => {
    listPaymentMethodsAction.mockResolvedValue({ ok: false, error: { message: "boom" } });
    renderCard();

    await waitFor(() =>
      expect(screen.getByText(enMessages.paymentMethods.loadError)).toBeDefined()
    );
    expect(screen.queryByText(enMessages.paymentMethods.noMethods)).toBeNull();
  });

  /**
   * The parent remounts this card per company (keyed by company id), so a
   * fresh mount is the only path the app takes. Pinned here because the card
   * cannot reconcile a company switch in place — see the header comment — and
   * the parent-side key that makes that true is pinned in
   * company-settings-section-merged.test.tsx.
   */
  it("fetches for whichever company a fresh mount is handed", async () => {
    const first = renderCard(COMPANY_A);
    await waitFor(() => expect(listPaymentMethodsAction).toHaveBeenCalledWith(COMPANY_A));
    first.unmount();

    renderCard(COMPANY_B);
    await waitFor(() => expect(listPaymentMethodsAction).toHaveBeenCalledWith(COMPANY_B));
  });
});
