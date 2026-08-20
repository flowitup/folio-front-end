/**
 * Settings → Payment methods section.
 *
 * Pins the company-resolution rules (primary wins, picker only when the caller
 * has more than one company) and the permission split: the backend requires the
 * global admin permission for every mutation, so non-admins must get a
 * read-only inventory rather than controls that would always 403.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PaymentMethodsSettingsSection } from "../payment-methods-settings-section";
import type { MyCompany } from "@/types/companies";

const permissions = { current: ["*:*"] as string[] };

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "u@example.com", permissions: permissions.current } }),
}));

const fetchMyCompaniesAction = vi.fn();
const listPaymentMethodsAction = vi.fn();

vi.mock("@/app/[locale]/(app)/settings/_actions/companies-actions", () => ({
  fetchMyCompaniesAction: (...args: unknown[]) => fetchMyCompaniesAction(...args),
}));

vi.mock(
  "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions",
  () => ({
    listPaymentMethodsAction: (...args: unknown[]) => listPaymentMethodsAction(...args),
    createPaymentMethodAction: vi.fn(),
    updatePaymentMethodAction: vi.fn(),
    deletePaymentMethodAction: vi.fn(),
  })
);

function company(id: string, legal_name: string, is_primary: boolean): MyCompany {
  return {
    id,
    legal_name,
    address: "1 rue de la Paix",
    siret: null,
    tva_number: null,
    iban: null,
    bic: null,
    logo_url: null,
    default_payment_terms: null,
    prefix_override: null,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_primary,
    attached_at: "2026-01-01T00:00:00Z",
    role: "admin",
  };
}

const METHOD = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  companyId: "11111111-1111-1111-1111-111111111111",
  label: "Wise",
  isBuiltin: false,
  isActive: true,
  isCompanyPayment: false,
  isPersonalPayment: false,
  usageCount: 0,
};

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PaymentMethodsSettingsSection />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions.current = ["*:*"];
  listPaymentMethodsAction.mockResolvedValue({ ok: true, data: [METHOD] });
});

describe("PaymentMethodsSettingsSection", () => {
  it("loads the primary company's methods and hides the picker for a single company", async () => {
    fetchMyCompaniesAction.mockResolvedValue({
      ok: true,
      data: [company(A, "Acme SARL", true)],
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    expect(listPaymentMethodsAction).toHaveBeenCalledWith(A);
    expect(screen.queryByLabelText("Company")).toBeNull();
  });

  it("defaults to the primary company when several are attached, and shows the picker", async () => {
    fetchMyCompaniesAction.mockResolvedValue({
      ok: true,
      data: [company(A, "Acme SARL", false), company(B, "Beta SAS", true)],
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    // Primary (Beta) wins over list order.
    expect(listPaymentMethodsAction).toHaveBeenCalledWith(B);
    expect(screen.getByLabelText("Company")).toBeDefined();
  });

  it("renders add/edit/delete controls for an admin", async () => {
    fetchMyCompaniesAction.mockResolvedValue({
      ok: true,
      data: [company(A, "Acme SARL", true)],
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();
    expect(screen.getByRole("button", { name: 'Edit "Wise"' })).toBeDefined();
    expect(screen.getByRole("button", { name: 'Delete "Wise"' })).toBeDefined();
  });

  it("renders a read-only list without mutation controls for a non-admin", async () => {
    permissions.current = ["invoices:read"];
    fetchMyCompaniesAction.mockResolvedValue({
      ok: true,
      data: [company(A, "Acme SARL", true)],
    });

    renderSection();

    await waitFor(() => expect(screen.getByText("Wise")).toBeDefined());
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: 'Edit "Wise"' })).toBeNull();
    expect(screen.queryByRole("button", { name: 'Delete "Wise"' })).toBeNull();
    expect(
      screen.getByText(enMessages.paymentMethods.readOnlyNote)
    ).toBeDefined();
  });

  it("explains the empty state when the caller has no company", async () => {
    fetchMyCompaniesAction.mockResolvedValue({ ok: true, data: [] });

    renderSection();

    await waitFor(() =>
      expect(screen.getByText(enMessages.paymentMethods.noCompanies)).toBeDefined()
    );
    expect(listPaymentMethodsAction).not.toHaveBeenCalled();
  });

  it("surfaces a load error instead of an empty list", async () => {
    fetchMyCompaniesAction.mockResolvedValue({
      ok: true,
      data: [company(A, "Acme SARL", true)],
    });
    listPaymentMethodsAction.mockResolvedValue({
      ok: false,
      error: { code: "generic", message: "boom" },
    });

    renderSection();

    await waitFor(() =>
      expect(screen.getByText(enMessages.paymentMethods.loadError)).toBeDefined()
    );
  });
});
